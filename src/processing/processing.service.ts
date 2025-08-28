import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DocumentStatus } from 'src/documents/entity/document.entity';

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    @InjectQueue('document-processing')
    private readonly documentQueue: Queue,
  ) { }

  async addDocumentToQueue(
    documentId: string,
    file: Express.Multer.File,
  ): Promise<void> {
    this.logger.log(`Adding document ${documentId} to processing queue`);

    await this.documentQueue.add(
      'process-document',
      {
        documentId,
        fileBuffer: file.buffer.toString('base64'),
        fileName: file.originalname,
        mimeType: file.mimetype,
      },
      {
        priority: 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    );

    this.logger.log(`Document ${documentId} added to processing queue`);
  }

  async getQueueStatus(): Promise<any> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.documentQueue.getWaitingCount(),
      this.documentQueue.getActiveCount(),
      this.documentQueue.getCompletedCount(),
      this.documentQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    };
  }
}