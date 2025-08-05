import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ChunkService } from 'src/chunks/chunk.service';
import { JOB_TYPES, QUEUE_NAMES } from '../queue.constants';
import { EmbeddingJobData } from '../types/job-data';

@Injectable()
@Processor(QUEUE_NAMES.EMBEDDING_GENERATION)
export class EmbeddingGenerationProcessor extends WorkerHost {
    private readonly logger = new Logger(EmbeddingGenerationProcessor.name);

    constructor(
        private readonly chunkService: ChunkService,
        @InjectQueue(QUEUE_NAMES.QUESTION_GENERATION)
        private questionQueue: Queue,
        @InjectQueue(QUEUE_NAMES.NOTIFICATION)
        private notificationQueue: Queue,
    ) {
        super();
    }

    async process(job: Job<EmbeddingJobData, any, string>) {
        if (job.name !== JOB_TYPES.GENERATE_EMBEDDINGS) {
            return;
        }

        const { documentId, userId, chunks } = job.data;

        try {
            await this.notificationQueue.add(JOB_TYPES.SEND_NOTIFICATION, {
                userId,
                documentId,
                type: 'progress',
                step: 'generating_embeddings',
                progress: 75,
            });

            const batchSize = 5;
            const totalBatches = Math.ceil(chunks.length / batchSize);

            for (let i = 0; i < totalBatches; i++) {
                const batch = chunks.slice(i * batchSize, (i + 1) * batchSize);
                await this.chunkService.processChunks(documentId, batch);

                const progress = 75 + Math.floor((i + 1) / totalBatches * 15);
                await job.updateProgress(progress);

                if (i < totalBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            await this.questionQueue.add(
                JOB_TYPES.GENERATE_QUESTIONS,
                {
                    documentId,
                    userId,
                },
                {
                    priority: 10,
                }
            );

            await job.updateProgress(100);

            return {
                success: true,
                chunksProcessed: chunks.length
            };
        } catch (error) {
            this.logger.error(`Error generating embeddings for ${documentId}:`, error);

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