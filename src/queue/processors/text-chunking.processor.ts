import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { TextChunkerService } from 'src/common/services/text-chunker.service';
import { JOB_TYPES, QUEUE_NAMES } from '../queue.constants';
import { ChunkingJobData } from '../types/job-data';

@Injectable()
@Processor(QUEUE_NAMES.TEXT_CHUNKING)
export class TextChunkingProcessor extends WorkerHost {
    private readonly logger = new Logger(TextChunkingProcessor.name);

    constructor(
        private readonly textChunkerService: TextChunkerService,
        @InjectQueue(QUEUE_NAMES.EMBEDDING_GENERATION)
        private embeddingQueue: Queue,
        @InjectQueue(QUEUE_NAMES.NOTIFICATION)
        private notificationQueue: Queue,
    ) {
        super();
    }

    async process(job: Job<ChunkingJobData, any, string>) {
        // Solo procesar jobs del tipo correcto
        if (job.name !== JOB_TYPES.CREATE_CHUNKS) {
            return;
        }

        const { documentId, userId, extractedText, pageMapping } = job.data;

        try {
            // Notificar progreso
            await this.notificationQueue.add(JOB_TYPES.SEND_NOTIFICATION, {
                userId,
                documentId,
                type: 'progress',
                step: 'creating_chunks',
                progress: 50,
            });

            // Crear chunks
            await job.updateProgress(50);
            const chunks = await this.textChunkerService.createChunks(
                extractedText,
                pageMapping
            );

            // Programar generación de embeddings
            await job.updateProgress(80);
            await this.embeddingQueue.add(
                JOB_TYPES.GENERATE_EMBEDDINGS,
                {
                    documentId,
                    userId,
                    chunks,
                },
                {
                    priority: 10,
                }
            );

            await job.updateProgress(100);

            return {
                success: true,
                chunksCount: chunks.length
            };
        } catch (error) {
            this.logger.error(`Error creating chunks for ${documentId}:`, error);

            await this.notificationQueue.add(JOB_TYPES.SEND_NOTIFICATION, {
                userId,
                documentId,
                type: 'failed',
                error: error.message,
            });

            throw error;
        }
    }
}