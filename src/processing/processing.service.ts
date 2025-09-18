import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

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
    userId?: string,
  ): Promise<void> {
    this.logger.log(`Adding document ${documentId} to processing queue`);

    await this.documentQueue.add(
      'process-document',
      {
        documentId,
        fileBuffer: file.buffer.toString('base64'),
        fileName: file.originalname,
        mimeType: file.mimetype,
        userId,
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
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.documentQueue.getWaitingCount(),
      this.documentQueue.getActiveCount(),
      this.documentQueue.getCompletedCount(),
      this.documentQueue.getFailedCount(),
      this.documentQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.documentQueue.getJob(jobId);

      if (!job) {
        return null;
      }

      return {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        opts: job.opts,
      };
    } catch (error) {
      this.logger.error(`Error getting job status for ${jobId}:`, error);
      return null;
    }
  }

  async removeJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.documentQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Job ${jobId} removed from queue`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error removing job ${jobId}:`, error);
      return false;
    }
  }

  async retryFailedJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.documentQueue.getJob(jobId);
      if (job && await job.isFailed()) {
        await job.retry();
        this.logger.log(`Job ${jobId} retried`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error retrying job ${jobId}:`, error);
      return false;
    }
  }

  async pauseQueue(): Promise<void> {
    await this.documentQueue.pause();
    this.logger.log('Document processing queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.documentQueue.resume();
    this.logger.log('Document processing queue resumed');
  }

  async cleanQueue(grace: number = 0): Promise<void> {
    await this.documentQueue.clean(grace, 100, 'completed');
    await this.documentQueue.clean(grace, 100, 'failed');
    this.logger.log(`Queue cleaned - removed jobs older than ${grace}ms`);
  }

  async getJobsByDocumentId(documentId: string): Promise<any[]> {
    try {
      const jobs = await this.documentQueue.getJobs(['waiting', 'active', 'completed', 'failed']);

      return jobs
        .filter(job => job.data.documentId === documentId)
        .map(job => ({
          id: job.id,
          name: job.name,
          progress: job.progress,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
        }));
    } catch (error) {
      this.logger.error(`Error getting jobs for document ${documentId}:`, error);
      return [];
    }
  }
}