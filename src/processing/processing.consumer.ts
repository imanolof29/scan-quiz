import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentEntity, DocumentStatus } from 'src/documents/entity/document.entity';
import { FileUploadService } from 'src/common/services/file-upload.service';
import { PdfProcessorService } from 'src/common/services/pdf-processor.service';
import { TextChunkerService } from 'src/common/services/text-chunker.service';
import { ChunkService } from 'src/chunks/chunk.service';
import { QuestionsService } from 'src/questions/question.service';
import { DocumentProcessingGateway } from 'src/documents/documents.gateway';
import { Step } from './types/step';


@Processor('document-processing', {
  concurrency: 5,
  limiter: {
    max: 5,
    duration: 1000,
  },
})
export class ProcessingConsumer extends WorkerHost {
  private readonly logger = new Logger(ProcessingConsumer.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private documentsRepository: Repository<DocumentEntity>,
    private fileUploadService: FileUploadService,
    private pdfProcessorService: PdfProcessorService,
    private textChunkerService: TextChunkerService,
    private chunksService: ChunkService,
    private questionsService: QuestionsService,
    private documentProcessingGateway: DocumentProcessingGateway,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { documentId, fileBuffer, userId } = job.data;
    let currentStatus = DocumentStatus.PROCESSING;
    const buffer = Buffer.from(fileBuffer, 'base64');
    const startTime = Date.now();

    try {
      this.logger.log(`Processing document ${documentId} | Attempt: ${job.attemptsMade + 1}`);

      const document = await this.documentsRepository.findOne({
        where: { id: documentId }
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${documentId} not found`);
      }

      await this.updateDocumentStatus(documentId, currentStatus);
      await this.notifyStatusUpdate({
        documentId,
        userId: document.userId,
        status: currentStatus,
        progress: 5,
        message: 'Starting document processing...'
      });

      await job.updateProgress(10);
      this.logger.log(`Uploading file to S3 for document ${documentId}`);

      await this.notifyStatusUpdate({
        documentId,
        userId: document.userId,
        status: DocumentStatus.UPLOADING,
        progress: 10,
        message: 'Uploading file to cloud storage...'
      });

      const s3Key = `documents/${documentId}.pdf`;
      await this.fileUploadService.uploadToS3(buffer, s3Key);
      await this.documentsRepository.update(documentId, { s3Key });

      await job.updateProgress(20);
      currentStatus = DocumentStatus.EXTRACTING;
      await this.updateDocumentStatus(documentId, currentStatus);

      this.logger.log(`Extracting text from PDF for document ${documentId}`);
      await this.notifyStatusUpdate({
        documentId,
        userId: document.userId,
        status: currentStatus,
        progress: 20,
        message: 'Extracting text from PDF...'
      });

      const extractedData = await this.pdfProcessorService.extractText(buffer);
      if (!extractedData?.text) {
        throw new Error('Failed to extract text from PDF');
      }

      this.logger.log(`Text extracted successfully, length: ${extractedData.text.length}`);

      await job.updateProgress(40);
      currentStatus = DocumentStatus.CHUNKING;
      await this.updateDocumentStatus(documentId, currentStatus);

      this.logger.log(`Creating chunks for document ${documentId}`);
      await this.notifyStatusUpdate({
        documentId,
        userId: document.userId,
        status: currentStatus,
        progress: 40,
        message: 'Dividing document into sections...'
      });

      const chunks = await this.textChunkerService.createChunks(
        extractedData.text,
        extractedData.pageMapping || [],
      );

      if (!chunks || chunks.length === 0) {
        throw new Error('Failed to create chunks from document');
      }

      this.logger.log(`Created ${chunks.length} chunks for document ${documentId}`);

      // Progreso: 60% - Generar embeddings y guardar chunks
      await job.updateProgress(60);
      await this.notifyStatusUpdate({
        documentId,
        userId: document.userId,
        status: currentStatus,
        progress: 60,
        message: `Processing ${chunks.length} document sections...`
      });

      await this.chunksService.processChunks(documentId, chunks);

      // Progreso: 80% - Generar preguntas
      await job.updateProgress(80);
      currentStatus = DocumentStatus.GENERATING_QUESTIONS;
      await this.updateDocumentStatus(documentId, currentStatus);

      this.logger.log(`Generating questions for document ${documentId}`);
      await this.notifyStatusUpdate({
        documentId,
        userId: document.userId,
        status: currentStatus,
        progress: 80,
        message: 'Generating practice questions...'
      });

      const questions = await this.questionsService.generateQuestionsForDocument(documentId);
      const questionsCount = questions?.length || 0;

      await job.updateProgress(95);
      currentStatus = DocumentStatus.COMPLETED;
      await this.notifyStatusUpdate({
        documentId,
        userId: document.userId,
        status: currentStatus,
        progress: 95,
        message: 'Finalizing processing...'
      });


      await this.updateDocumentStatus(documentId, currentStatus);

      // Progreso: 100%
      await job.updateProgress(100);

      const processingTime = Math.round((Date.now() - startTime) / 1000);

      this.logger.log(`Document ${documentId} processing completed successfully in ${processingTime}s`);

      // Notificar completion con datos adicionales
      await this.documentProcessingGateway.notifyDocumentCompleted(
        documentId,
        document.userId,
        {
          questionsCount,
          processingTime,
          title: document.title,
        }
      );

      return {
        success: true,
        documentId,
        questionsCount,
        processingTime
      };

    } catch (error) {
      this.logger.error(`Error processing document ${documentId}:`, error);

      // Obtener userId para notificación de error
      const document = await this.documentsRepository.findOne({
        where: { id: documentId },
        select: ['userId']
      });

      const documentUserId = userId || document?.userId;

      // Marcar como fallido
      await this.updateDocumentStatus(
        documentId,
        DocumentStatus.FAILED,
        error.message
      );

      // Notificar error
      if (documentUserId) {
        await this.documentProcessingGateway.notifyDocumentFailed(
          documentId,
          documentUserId,
          error.message
        );
      }

      throw error;
    }
  }

  private async updateDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const updateData: any = { status };

      if (errorMessage && status === DocumentStatus.FAILED) {
        updateData.errorMessage = errorMessage;
        updateData.updatedAt = new Date();
      }

      const result = await this.documentsRepository.update(documentId, updateData);

      if (result.affected === 0) {
        this.logger.warn(`No document found with ID ${documentId} to update status`);
      } else {
        this.logger.log(`Document ${documentId} status updated to: ${status}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update document status for ${documentId}:`, error);
    }
  }

  private async notifyStatusUpdate(step: Step): Promise<void> {
    try {
      await this.documentProcessingGateway.notifyDocumentStatusUpdate(step);
    } catch (error) {
      this.logger.error(`Failed to send WebSocket notification for document ${step.documentId}:`, error);
    }
  }
}