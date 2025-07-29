import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DocumentEntity } from "./entity/document.entity";
import { Repository } from 'typeorm';
import { QuestionsService } from "src/questions/question.service";
import { ChunkService } from "src/chunks/chunk.service";
import { FileUploadService } from "src/common/services/file-upload.service";
import { PdfProcessorService } from "src/common/services/pdf-processor.service";
import { TextChunkerService } from "src/common/services/text-chunker.service";

@Injectable()
export class DocumentsService {
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

    async uploadAndProcess(
        file: Express.Multer.File,
        userId: string,
        generateQuestions: boolean = true,
    ) {
        // const estimatedCredits = this.estimateCredits(file.size);
        // const hasCredits = await this.creditsService.hasEnoughCredits(userId, estimatedCredits);

        // if (!hasCredits) {
        //     throw new ForbiddenException('Insufficient credits');
        // }

        // 2. Crear documento en BD
        const document = this.documentsRepository.create({
            title: file.originalname.replace('.pdf', ''),
            filename: file.originalname,
            status: 'processing',
        });

        const savedDocument = await this.documentsRepository.save(document);

        // 3. Procesar asíncronamente (no bloquear la respuesta)
        this.processDocumentAsync(savedDocument[0], file, generateQuestions);

        return savedDocument;
    }

    private async processDocumentAsync(
        document: DocumentEntity,
        file: Express.Multer.File,
        generateQuestions: boolean,
    ) {
        try {
            // 1. Subir archivo a S3
            const s3Key = `documents/${document.id}.pdf`;
            await this.fileUploadService.uploadToS3(file.buffer, s3Key);

            await this.documentsRepository.update(document.id, { s3Key });

            // 2. Extraer texto del PDF
            const extractedData = await this.pdfProcessorService.extractText(file.buffer);

            // await this.documentsRepository.update(document.id, {
            //     totalPages: extractedData.totalPages
            // });

            // 3. Dividir en chunks
            const chunks = await this.textChunkerService.createChunks(
                extractedData.text,
                extractedData.pageMapping,
            );

            // 4. Generar embeddings y guardar chunks
            await this.chunksService.processChunks(document.id, chunks);

            // 5. Generar preguntas si se solicita
            if (generateQuestions) {
                await this.questionsService.generateQuestionsForDocument(document.id);
            }

            // 6. Calcular y deducir créditos reales
            // const realCredits = await this.calculateRealCredits(document.id);
            // await this.creditsService.deductCredits(
            //     document.user.id,
            //     realCredits,
            //     `Document processing: ${document.title}`,
            //     document.id,
            // );

            // 7. Marcar como completado
            await this.documentsRepository.update(document.id, {
                status: 'completed',
                // creditsUsed: realCredits,
            });

        } catch (error) {
            console.error('Error processing document:', error);
            await this.documentsRepository.update(document.id, {
                status: 'failed'
            });
        }
    }

    async getDocumentQuestions(documentId: string, userId: string) {
        const document = await this.documentsRepository.findOne({
            where: { id: documentId },
            relations: ['questions'],
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        if (document.status !== 'completed') {
            throw new BadRequestException('Document is still processing');
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
                pageReferences: q.pageReferences,
            })),
            totalQuestions: document.questions.length,
            estimatedTime: Math.ceil(document.questions.length * 1.5), // 1.5 min por pregunta
        };
    }

    async getDocumentStatus(documentId: string, userId: string) {
        const document = await this.documentsRepository.findOne({
            where: { id: documentId },
            select: ['id', 'title', 'status', 'createdAt'],
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        return document;
    }

    private estimateCredits(fileSize: number): number {
        return Math.ceil(fileSize / (100 * 1024));
    }

    private async calculateRealCredits(documentId: string): Promise<number> {
        // Cálculo real basado en tokens usados
        const document = await this.documentsRepository.findOne({
            where: { id: documentId },
            relations: ['chunks', 'questions'],
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        const tokensUsed = document.chunks.reduce((total, chunk) => total + chunk.tokenCount, 0);
        const questionsGenerated = document.questions.length;

        // 1 crédito por cada 1000 tokens + 0.1 crédito por pregunta
        return Math.ceil(tokensUsed / 1000) + Math.ceil(questionsGenerated * 0.1);
    }
}