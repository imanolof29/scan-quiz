import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { JOB_TYPES, QUEUE_NAMES } from "../queue.constants";
import { Job, Queue } from "bullmq";
import { QuestionsService } from "src/questions/question.service";
import { InjectRepository } from "@nestjs/typeorm";
import { DocumentEntity } from "src/documents/entity/document.entity";
import { Repository } from 'typeorm';
import { QuestionJobData } from "../types/job-data";

@Injectable()
@Processor(QUEUE_NAMES.QUESTION_GENERATION)
export class QuestionGenerationProcessor extends WorkerHost {

    private readonly logger = new Logger(QuestionGenerationProcessor.name);

    constructor(
        private readonly questionsService: QuestionsService,
        @InjectRepository(DocumentEntity)
        private readonly documentsRepository: Repository<DocumentEntity>,
        @InjectQueue(QUEUE_NAMES.NOTIFICATION)
        private notificationQueue: Queue,
    ) {
        super();
    }

    async process(job: Job<QuestionJobData>): Promise<any> {
        if (job.name !== QUEUE_NAMES.QUESTION_GENERATION) {
            return;
        }

        const { userId, documentId } = job.data;

        try {
            await job.updateProgress(50);
            await this.questionsService.generateQuestionsForDocument(documentId);

            await job.updateProgress(80)
            await this.documentsRepository.update(documentId, {
                status: 'completed',
            });

            await this.notificationQueue.add(JOB_TYPES.SEND_NOTIFICATION, {
                userId,
                documentId,
                type: 'completed',
                progress: 100
            })

            await job.updateProgress(100);

            return {
                success: true,
            }

        } catch (error) {
            this.logger.error(`Error processing question generation job: ${error.message}`);

            await this.documentsRepository.update(documentId, {
                status: 'failed',
            })

            await this.notificationQueue.add(JOB_TYPES.SEND_NOTIFICATION, {
                userId: userId,
                documentId: documentId,
                type: 'error',
                message: `Failed to generate questions for document ${documentId}`,
            });
            throw error;
        }
    }

}