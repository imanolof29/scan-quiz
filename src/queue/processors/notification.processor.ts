import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { QUEUE_NAMES } from "../queue.constants";
import { Job } from "bullmq";
import { NotificationJobData } from "../types/job-data";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {

    private readonly logger = new Logger(NotificationProcessor.name);

    constructor(
        private readonly eventEmitter: EventEmitter2
    ) {
        super();
    }

    async process(job: Job<NotificationJobData>): Promise<any> {
        if (job.name !== QUEUE_NAMES.NOTIFICATION) {
            return;
        }

        const { userId, documentId, type, step, progress, error } = job.data;

        try {
            this.logger.log(`Sending notification to user ${userId} for document ${documentId}: ${type} - ${step} at ${progress}%`);

            this.eventEmitter.emit('document.progress', {
                userId,
                documentId,
                type,
                step,
                progress,
                error,
                timestamp: new Date(),
            })

            return {
                success: true,
            };
        } catch (error) {
            this.logger.error(`Failed to send notification for document ${documentId}: ${error.message}`);
            throw error;
        }
    }

}