import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DocumentEntity } from "./entity/document.entity";
import { Repository } from 'typeorm';
import { FileUploadService } from "src/common/services/file-upload.service";
import { DocumentDto } from "./dto/document.dto";
import { InjectQueue } from "@nestjs/bullmq";
import { JOB_TYPES, QUEUE_NAMES } from "src/queue/queue.constants";
import { Queue } from "bullmq";
import { ProcessDocumentJobData } from "src/queue/types/job-data";

@Injectable()
export class DocumentsService {
    constructor(
        @InjectRepository(DocumentEntity)
        private documentsRepository: Repository<DocumentEntity>,
        private fileUploadService: FileUploadService,
        @InjectQueue(QUEUE_NAMES.DOCUMENT_PROCESSING)
        private documentProcessingQueue: Queue,
    ) { }

    async getDocuments(userId: string): Promise<DocumentDto[]> {
        const documents = await this.documentsRepository.find({
            select: ['id', 'title', 'filename', 'status', 'createdAt', 'questions'],
            where: { userId },
            order: { createdAt: 'DESC' },
        });

        return documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            filename: doc.filename,
            status: doc.status,
            createdAt: doc.createdAt,
            questions: doc.questions?.length || 0,
        }));
    }

    async uploadAndProcess(
        file: Express.Multer.File,
        userId: string,
    ) {
        // 1. Crear documento en BD
        const document = this.documentsRepository.create({
            title: file.originalname.replace('.pdf', ''),
            filename: file.originalname,
            status: 'uploading',
            userId
        });

        await this.documentsRepository.save(document);

        try {
            // 2. Subir archivo a S3
            const s3Key = `documents/${document.id}.pdf`;
            await this.fileUploadService.uploadToS3(file.buffer, s3Key);

            // 3. Actualizar con S3 key
            await this.documentsRepository.update(document.id, {
                s3Key,
                status: 'processing'
            });

            // 4. Agregar trabajo a la cola principal
            const jobData: ProcessDocumentJobData = {
                documentId: document.id,
                userId,
                fileName: file.originalname,
                s3Key,
            };

            const job = await this.documentProcessingQueue.add(
                JOB_TYPES.PROCESS_DOCUMENT,
                jobData,
                {
                    priority: 10,
                    delay: 1000, // Pequeño delay para dar tiempo a la respuesta
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000,
                    },
                }
            );

            // 5. Actualizar documento con job ID para tracking
            await this.documentsRepository.update(document.id, {
                jobId: job.id?.toString()
            });

            return document;

        } catch (error) {
            // Marcar como fallido si hay error en upload
            await this.documentsRepository.update(document.id, {
                status: 'failed'
            });
            throw error;
        }
    }

    async getDocumentQuestions(documentId: string, userId: string) {
        try {
            const document = await this.documentsRepository.findOne({
                where: { id: documentId, userId },
                relations: ['questions'],
            });

            if (!document) {
                throw new NotFoundException('Document not found');
            }

            if (document.status === 'processing') {
                throw new BadRequestException('Document is still processing');
            }

            if (document.status === 'failed') {
                throw new BadRequestException('Document processing failed');
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
                estimatedTime: Math.ceil(document.questions.length * 1.5),
            };
        } catch (error) {
            console.error('Error fetching document questions:', error);
            throw error;
        }
    }

    async getDocumentStatus(documentId: string, userId: string) {
        const document = await this.documentsRepository.findOne({
            where: { id: documentId, userId },
            select: ['id', 'title', 'status', 'createdAt', 'jobId'],
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        // Si tiene jobId, intentar obtener información del job
        let jobInfo;
        if (document.jobId) {
            try {
                const job = await this.documentProcessingQueue.getJob(document.jobId);
                if (job) {
                    jobInfo = {
                        progress: job.progress(),
                        processedOn: job.processedOn,
                        finishedOn: job.finishedOn,
                        failedReason: job.failedReason,
                    };
                }
            } catch (error) {
                // Job no encontrado o error, no pasa nada
            }
        }

        return {
            ...document,
            jobInfo,
        };
    }

    async retryFailedDocument(documentId: string, userId: string) {
        const document = await this.documentsRepository.findOne({
            where: { id: documentId, userId },
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        if (document.status !== 'failed') {
            throw new BadRequestException('Only failed documents can be retried');
        }

        if (!document.s3Key) {
            throw new BadRequestException('Document file not found');
        }

        // Reiniciar procesamiento
        await this.documentsRepository.update(documentId, {
            status: 'processing',
        });

        const jobData: ProcessDocumentJobData = {
            documentId: document.id,
            userId,
            fileName: document.filename,
            s3Key: document.s3Key,
        };

        const job = await this.documentProcessingQueue.add(
            JOB_TYPES.PROCESS_DOCUMENT,
            jobData,
            {
                priority: 15,
                attempts: 2,
            }
        );

        await this.documentsRepository.update(documentId, {
            jobId: job.id?.toString(),
        });

        return { success: true, jobId: job.id };
    }

    async cancelDocumentProcessing(documentId: string, userId: string) {
        const document = await this.documentsRepository.findOne({
            where: { id: documentId, userId },
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        if (document.status !== 'processing') {
            throw new BadRequestException('Only processing documents can be cancelled');
        }

        // Intentar cancelar el job
        if (document.jobId) {
            try {
                const job = await this.documentProcessingQueue.getJob(document.jobId);
                if (job) {
                    await job.remove();
                }
            } catch (error) {
                // Job ya procesado o no existe
            }
        }

        // Marcar como cancelado
        await this.documentsRepository.update(documentId, {
            status: 'cancelled',
        });

        return { success: true };
    }

    async getQueueStats() {
        const stats = {
            documentProcessing: await this.documentProcessingQueue.getJobCounts(),
        };

        return stats;
    }
}
