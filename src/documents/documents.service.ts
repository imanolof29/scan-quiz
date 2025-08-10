import { BadRequestException, Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DocumentEntity, DocumentStatus } from "./entity/document.entity";
import { Repository } from 'typeorm';
import { QuestionsService } from "src/questions/question.service";
import { ChunkService } from "src/chunks/chunk.service";
import { FileUploadService } from "src/common/services/file-upload.service";
import { PdfProcessorService } from "src/common/services/pdf-processor.service";
import { TextChunkerService } from "src/common/services/text-chunker.service";
import { DocumentDto } from "./dto/document.dto";

@Injectable()
export class DocumentsService {
    private readonly logger = new Logger(DocumentsService.name);

    constructor(
        @InjectRepository(DocumentEntity)
        private documentsRepository: Repository<DocumentEntity>,
        private chunksService: ChunkService,
        private questionsService: QuestionsService,
        //private creditsService: CreditsService,
        private fileUploadService: FileUploadService,
        private pdfProcessorService: PdfProcessorService,
        private textChunkerService: TextChunkerService,
    ) { }

    async getDocuments(userId: string): Promise<DocumentDto[]> {
        try {
            // const documents = await this.documentsRepository.find({
            //     select: ['id', 'title', 'filename', 'status', 'createdAt'],
            //     where: { userId },
            //     order: { createdAt: 'DESC' },
            // });

            const documents = await this.documentsRepository
                .createQueryBuilder('document')
                .select(['document.id', 'document.title', 'document.filename', 'document.status', 'document.createdAt'])
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

        // const estimatedCredits = this.estimateCredits(file.size);
        // const hasCredits = await this.creditsService.hasEnoughCredits(userId, estimatedCredits);

        // if (!hasCredits) {
        //     throw new ForbiddenException('Insufficient credits');
        // }

        try {
            // 1. Crear documento en BD
            const document = this.documentsRepository.create({
                title: file.originalname.replace('.pdf', ''),
                filename: file.originalname,
                status: DocumentStatus.UPLOADING,
                userId
            });

            const savedDocument = await this.documentsRepository.save(document);

            if (!savedDocument?.id) {
                throw new Error('Failed to save document to database');
            }

            this.logger.log(`Document created with ID: ${savedDocument.id}`);

            // 2. Procesar asíncronamente (sin bloquear la respuesta)
            // Ejecutar en background sin await
            setImmediate(() => {
                this.processDocumentAsync(savedDocument.id, file);
            });

            return {
                success: true,
                documentId: savedDocument.id,
                status: savedDocument.status,
                message: 'Document uploaded successfully, processing started'
            };

        } catch (error) {
            this.logger.error('Error in uploadAndProcess:', error);
            throw error;
        }
    }

    private async processDocumentAsync(
        documentId: string,
        file: Express.Multer.File,
    ) {
        let currentStatus = 'processing';

        try {
            this.logger.log(`Starting async processing for document ${documentId}`);

            // Verificar que el documento existe
            let document = await this.documentsRepository.findOne({
                where: { id: documentId }
            });

            if (!document) {
                this.logger.error(`Document with ID ${documentId} not found`);
                return;
            }

            // 1. Actualizar estado a procesando
            currentStatus = 'processing';
            await this.updateDocumentStatus(documentId, currentStatus);

            // 2. Subir archivo a S3
            this.logger.log(`Uploading file to S3 for document ${documentId}`);
            const s3Key = `documents/${documentId}.pdf`;
            await this.fileUploadService.uploadToS3(file.buffer, s3Key);

            await this.documentsRepository.update(documentId, { s3Key });
            this.logger.log(`File uploaded to S3 with key: ${s3Key}`);

            // 3. Extraer texto del PDF
            currentStatus = 'extracting';
            await this.updateDocumentStatus(documentId, currentStatus);
            this.logger.log(`Extracting text from PDF for document ${documentId}`);

            const extractedData = await this.pdfProcessorService.extractText(file.buffer);

            if (!extractedData?.text) {
                throw new Error('Failed to extract text from PDF');
            }

            this.logger.log(`Text extracted successfully, length: ${extractedData.text.length}`);

            // 4. Dividir en chunks
            currentStatus = 'chunking';
            await this.updateDocumentStatus(documentId, currentStatus);
            this.logger.log(`Creating chunks for document ${documentId}`);

            const chunks = await this.textChunkerService.createChunks(
                extractedData.text,
                extractedData.pageMapping || [],
            );

            if (!chunks || chunks.length === 0) {
                throw new Error('Failed to create chunks from document');
            }

            this.logger.log(`Created ${chunks.length} chunks for document ${documentId}`);

            // 5. Generar embeddings y guardar chunks
            await this.chunksService.processChunks(documentId, chunks);
            this.logger.log(`Chunks processed and saved for document ${documentId}`);

            // 6. Generar preguntas
            currentStatus = 'generating_questions';
            await this.updateDocumentStatus(documentId, currentStatus);
            this.logger.log(`Generating questions for document ${documentId}`);

            await this.questionsService.generateQuestionsForDocument(documentId);

            // 7. Calcular y deducir créditos reales (comentado por ahora)
            // const realCredits = await this.calculateRealCredits(documentId);
            // await this.creditsService.deductCredits(
            //     document.userId,
            //     realCredits,
            //     `Document processing: ${document.title}`,
            //     documentId,
            // );

            // 8. Marcar como completado
            currentStatus = 'completed';
            await this.updateDocumentStatus(documentId, currentStatus);

            this.logger.log(`Document ${documentId} processing completed successfully`);

        } catch (error) {
            this.logger.error(`Error processing document ${documentId}:`, error);

            // Marcar como fallido con mensaje de error específico
            await this.updateDocumentStatus(documentId, 'failed', error.message);
        }
    }

    private async updateDocumentStatus(
        documentId: string,
        status: string,
        errorMessage?: string
    ): Promise<void> {
        try {
            const updateData: any = { status };

            if (errorMessage && status === 'failed') {
                updateData.errorMessage = errorMessage;
            }

            const result = await this.documentsRepository.update(documentId, updateData);

            if (result.affected === 0) {
                this.logger.warn(`No document found with ID ${documentId} to update status`);
            } else {
                this.logger.log(`Document ${documentId} status updated to: ${status}`);
            }
        } catch (error) {
            this.logger.error(`Failed to update document status for ${documentId}:`, error);
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
            });

            if (!document) {
                throw new NotFoundException(`Document with ID ${documentId} not found`);
            }

            // Verificar si el documento está procesado
            if (document.status !== 'completed') {
                throw new BadRequestException(`Document is still processing. Current status: ${document.status}`);
            }

            // Verificar si tiene preguntas
            if (!document.questions || document.questions.length === 0) {
                this.logger.warn(`Document ${documentId} has no questions`);
                return {
                    documentId: document.id,
                    title: document.title,
                    questions: [],
                    totalQuestions: 0,
                    estimatedTime: 0,
                };
            }

            return {
                documentId: document.id,
                title: document.title,
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
                select: ['id', 'title', 'status', 'createdAt'],
            });

            if (!document) {
                throw new NotFoundException(`Document with ID ${documentId} not found`);
            }

            return {
                id: document.id,
                title: document.title,
                status: document.status,
                createdAt: document.createdAt || new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error(`Error fetching document status for ${documentId}:`, error);

            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            throw new NotFoundException(`Document with ID ${documentId} not found`);
        }
    }

    private estimateCredits(fileSize: number): number {
        return Math.ceil(fileSize / (100 * 1024));
    }

    private async calculateRealCredits(documentId: string): Promise<number> {
        try {
            const document = await this.documentsRepository.findOne({
                where: { id: documentId },
                relations: ['chunks', 'questions'],
            });

            if (!document) {
                this.logger.error(`Document ${documentId} not found for credit calculation`);
                return 0;
            }

            const tokensUsed = document.chunks?.reduce((total, chunk) => total + (chunk.tokenCount || 0), 0) || 0;
            const questionsGenerated = document.questions?.length || 0;

            const totalCredits = Math.ceil(tokensUsed / 1000) + Math.ceil(questionsGenerated * 0.1);

            this.logger.log(`Credits calculated for document ${documentId}: ${totalCredits}`);

            return totalCredits;
        } catch (error) {
            this.logger.error(`Error calculating credits for document ${documentId}:`, error);
            return 0;
        }
    }
}