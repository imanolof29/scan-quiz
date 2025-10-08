import { BadRequestException, Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DocumentEntity, DocumentStatus, Source } from "./entity/document.entity";
import { Repository } from 'typeorm';
import { DocumentDto } from "./dto/document.dto";
import { ProcessingService } from "src/processing/processing.service";
import { CreateManualDocumentDto } from "./dto/create-manual-document.dto";
import { QuestionEntity } from "src/questions/entity/question.entity";

@Injectable()
export class DocumentsService {
    private readonly logger = new Logger(DocumentsService.name);

    constructor(
        @InjectRepository(DocumentEntity)
        private readonly documentsRepository: Repository<DocumentEntity>,
        @InjectRepository(QuestionEntity)
        private readonly questionRepository: Repository<QuestionEntity>,
        private readonly processingService: ProcessingService,
    ) { }

    async getDocuments(userId: string): Promise<DocumentDto[]> {
        try {
            const documents = await this.documentsRepository
                .createQueryBuilder('document')
                .select([
                    'document.id',
                    'document.title',
                    'document.filename',
                    'document.status',
                    'document.createdAt',
                ])
                .where('document.userId = :userId', { userId })
                .loadRelationCountAndMap('document.questionsCount', 'document.questions')
                .orderBy('document.createdAt', 'DESC')
                .getMany();

            return documents.map(doc => ({
                id: doc.id,
                title: doc.title,
                filename: doc.filename,
                status: doc.status,
                createdAt: doc.createdAt,
                questionsCount: doc['questionsCount'] || 0,
            }));
        } catch (error) {
            this.logger.error('Error fetching documents:', error);
            throw error;
        }
    }

    async uploadAndProcess(
        file: Express.Multer.File,
        userId: string,
    ) {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        if (!userId) {
            throw new BadRequestException('User ID is required');
        }

        if (file.mimetype !== 'application/pdf') {
            throw new BadRequestException('Only PDF files are allowed');
        }

        if (file.size > 50 * 1024 * 1024) { // 50MB
            throw new BadRequestException('File too large. Maximum size allowed is 50MB');
        }

        try {
            const document = this.documentsRepository.create({
                title: file.originalname.replace(/\.pdf$/i, ''),
                filename: file.originalname,
                status: DocumentStatus.UPLOADING,
                userId,
            });

            const savedDocument = await this.documentsRepository.save(document);

            if (!savedDocument?.id) {
                throw new Error('Failed to save document to database');
            }

            this.logger.log(`Document created with ID: ${savedDocument.id}`);

            await this.processingService.addDocumentToQueue(
                savedDocument.id,
                file,
                userId
            );

            return {
                success: true,
                documentId: savedDocument.id,
                status: savedDocument.status,
                message: 'Document uploaded successfully and added to processing queue'
            };

        } catch (error) {
            this.logger.error('Error in uploadAndProcess:', error);
            throw error;
        }
    }

    async getDocumentQuestions(documentId: string, userId: string) {
        if (!documentId || !userId) {
            throw new BadRequestException('Document ID and User ID are required');
        }

        try {
            const document = await this.documentsRepository.findOne({
                where: { id: documentId, userId },
                relations: ['questions'],
                select: [
                    'id',
                    'title',
                    'filename',
                    'status',
                    'createdAt',
                ],
            });

            if (!document) {
                throw new NotFoundException(`Document with ID ${documentId} not found or you don't have access to it`);
            }

            if (document.status !== DocumentStatus.COMPLETED) {
                return {
                    documentId: document.id,
                    title: document.title,
                    status: document.status,
                    message: `Document is still processing. Current status: ${document.status}`,
                    questions: [],
                    totalQuestions: 0,
                    estimatedTime: 0,
                };
            }

            if (!document.questions || document.questions.length === 0) {
                this.logger.warn(`Document ${documentId} has no questions`);
                return {
                    documentId: document.id,
                    title: document.title,
                    status: document.status,
                    message: 'Document processed but no questions were generated',
                    questions: [],
                    totalQuestions: 0,
                    estimatedTime: 0,
                };
            }

            return {
                documentId: document.id,
                title: document.title,
                status: document.status,
                questions: document.questions.map(q => ({
                    id: q.id,
                    question: q.question,
                    options: q.options,
                    correctAnswer: q.answerIndex,
                    difficulty: q.difficulty,
                    questionType: q.questionType,
                    pageReferences: q.pageReferences || [],
                })),
                totalQuestions: document.questions.length,
                estimatedTime: Math.ceil(document.questions.length * 1.5),
            };
        } catch (error) {
            this.logger.error(`Error fetching document questions for ${documentId}:`, error);

            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            throw new NotFoundException(`Document with ID ${documentId} not found`);
        }
    }

    async getDocumentStatus(documentId: string, userId: string) {
        if (!documentId || !userId) {
            throw new BadRequestException('Document ID and User ID are required');
        }

        try {
            const document = await this.documentsRepository.findOne({
                where: { id: documentId, userId },
                select: [
                    'id',
                    'title',
                    'filename',
                    'status',
                    'createdAt',
                ],
            });

            if (!document) {
                throw new NotFoundException(`Document with ID ${documentId} not found or you don't have access to it`);
            }

            let queueInfo = null;
            if ([DocumentStatus.UPLOADING, DocumentStatus.PROCESSING, DocumentStatus.EXTRACTING,
            DocumentStatus.CHUNKING, DocumentStatus.GENERATING_QUESTIONS].includes(document.status)) {

                const jobs = await this.processingService.getJobsByDocumentId(documentId);
                if (jobs.length > 0) {
                    const latestJob = jobs[jobs.length - 1];
                    queueInfo = {
                        progress: latestJob.progress || 0,
                        attemptsMade: latestJob.attemptsMade || 0,
                        processedOn: latestJob.processedOn,
                        estimatedCompletion: this.estimateCompletionTime(latestJob.progress || 0),
                    } as any;
                }
            }

            return {
                id: document.id,
                title: document.title,
                filename: document.filename,
                status: document.status,
                createdAt: document.createdAt,
                processing: queueInfo,
            };

        } catch (error) {
            this.logger.error(`Error fetching document status for ${documentId}:`, error);

            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            throw new NotFoundException(`Document with ID ${documentId} not found`);
        }
    }

    async deleteDocument(documentId: string, userId: string) {
        if (!documentId || !userId) {
            throw new BadRequestException('Document ID and User ID are required');
        }

        try {
            const document = await this.documentsRepository.findOne({
                where: { id: documentId, userId },
                relations: ['chunks', 'questions'],
            });

            if (!document) {
                throw new NotFoundException(`Document with ID ${documentId} not found or you don't have access to it`);
            }

            await this.documentsRepository.remove(document);

            this.logger.log(`Document ${documentId} deleted successfully`);

            return {
                success: true,
                message: 'Document deleted successfully'
            };

        } catch (error) {
            this.logger.error(`Error deleting document ${documentId}:`, error);

            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            throw new BadRequestException('Failed to delete document');
        }
    }

    async createManualDocument(userId: string, dto: CreateManualDocumentDto) {
        const document = this.documentsRepository.create({
            title: dto.title,
            status: DocumentStatus.COMPLETED,
            userId,
            source: Source.MANUAL
        })
        const questions = dto.questions.map(question => this.questionRepository.create({
            question: question.question,
            options: question.options,
            answerIndex: question.correctOptionIndex,
            document
        }))
        await this.documentsRepository.save(document);
        await this.questionRepository.save(questions);
    }

    private estimateCompletionTime(progress: number): string {
        if (progress >= 100) return '0 minutes';

        const remainingProgress = 100 - progress;
        const estimatedMinutes = Math.ceil(remainingProgress / 10);

        return `${estimatedMinutes} minute${estimatedMinutes !== 1 ? 's' : ''}`;
    }
}