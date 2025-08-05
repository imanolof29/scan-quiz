import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { JOB_TYPES, QUEUE_NAMES } from "../queue.constants";
import { Job, Queue } from "bullmq";
import { ProcessDocumentJobData } from "../types/job-data";

@Injectable()
@Processor(QUEUE_NAMES.DOCUMENT_PROCESSING)
export class DocumentOrchestratorProcessor extends WorkerHost {

    private readonly logger = new Logger(DocumentOrchestratorProcessor.name);

    constructor(
        @InjectQueue(QUEUE_NAMES.PDF_EXTRACTION)
        private pdfExtractionQueue: Queue,
        @InjectQueue(QUEUE_NAMES.NOTIFICATION)
        private notificationQueue: Queue,
    ) {
        super();
    }

    async process(job: Job<ProcessDocumentJobData, any, string>): Promise<any> {
        if (job.name !== JOB_TYPES.PROCESS_DOCUMENT) {
            return
        }

        const { documentId, userId, s3Key } = job.data
        this.logger.log(`Processing document ${documentId} for user ${userId}`);

        try {
            await this.notificationQueue.add(JOB_TYPES.SEND_NOTIFICATION, {
                userId,
                documentId,
                type: 'progress',
                step: 'started',
                progress: 0,
            })

            await job.updateProgress(20)

            const pdfJob = await this.pdfExtractionQueue.add(JOB_TYPES.EXTRACT_PDF_TEXT, {
                documentId,
                userId,
                s3Key,
            }, {
                priority: 10,
                delay: 0
            })

            await job.updateProgress(100)

            return {
                success: true,
                nextJobId: pdfJob.id,
            }

        } catch (error) {
            this.logger.error(`Failed to send notification for document ${documentId}: ${error.message}`);
            await this.notificationQueue.add(JOB_TYPES.SEND_NOTIFICATION, {
                userId,
                documentId,
                type: 'failed',
                error: error.message,
            });
            throw error;
        }
    }

    @OnWorkerEvent('active')
    onActive(job: Job) {
        this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job, result: any) {
        this.logger.log(`Job ${job.id} completed with result:`, result);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, err: Error) {
        this.logger.error(`Job ${job.id} failed:`, err);
    }

}