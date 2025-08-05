import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { JOB_TYPES, QUEUE_NAMES } from "../queue.constants";
import { PdfProcessorService } from "src/common/services/pdf-processor.service";
import { FileUploadService } from "src/common/services/file-upload.service";
import { Job, Queue } from "bullmq";
import { ExtractPdfJobData } from "../types/job-data";

@Injectable()
@Processor(QUEUE_NAMES.PDF_EXTRACTION)
export class PdfExtractionProcessor extends WorkerHost {

    private readonly logger = new Logger(PdfExtractionProcessor.name);

    constructor(
        private readonly pdfProcessorService: PdfProcessorService,
        private readonly fileUploadService: FileUploadService,
        @InjectQueue(QUEUE_NAMES.TEXT_CHUNKING)
        private readonly textChunkingQueue: Queue,
        @InjectQueue(QUEUE_NAMES.NOTIFICATION)
        private readonly notificationQueue: Queue
    ) {
        super();
    }

    async process(job: Job<ExtractPdfJobData, any, string>) {
        if (job.name !== QUEUE_NAMES.PDF_EXTRACTION) {
            return;
        }

        const { documentId, userId, s3Key } = job.data;

        try {
            await this.notificationQueue.add(JOB_TYPES.SEND_NOTIFICATION, {
                userId,
                documentId,
                type: 'progress',
                step: 'extracting_pdf',
                progress: 25
            })

            await job.updateProgress(30);
            const buffer = await this.fileUploadService.downloadFromS3(s3Key);

            await job.updateProgress(60);
            const extractedData = await this.pdfProcessorService.extractText(buffer);

            await job.updateProgress(80);
            await this.textChunkingQueue.add(JOB_TYPES.CREATE_CHUNKS, {
                documentId,
                userId,
                extractedData: extractedData.text,
                pageMapping: extractedData.pageMapping,
            }, {
                priority: 10,
            });

            return {
                success: true,
            }

        } catch (error) {
            this.logger.error(`Failed to process PDF extraction for document ${documentId}: ${error.message}`);

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