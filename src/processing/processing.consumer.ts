import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentEntity, DocumentStatus } from 'src/documents/entity/document.entity';
import { FileUploadService } from 'src/common/services/file-upload.service';
import { PdfProcessorService } from 'src/common/services/pdf-processor.service';
import { TextChunkerService } from 'src/common/services/text-chunker.service';
import { ChunkService } from 'src/chunks/chunk.service';
import { QuestionsService } from 'src/questions/question.service';

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
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { documentId, fileBuffer, fileName } = job.data;
    let currentStatus = DocumentStatus.PROCESSING;
    const buffer = Buffer.from(fileBuffer, 'base64');

    try {
      this.logger.log(`Processing document ${documentId} | Attempt: ${job.attemptsMade + 1}`);

      // Actualizar estado a procesando
      await this.updateDocumentStatus(documentId, currentStatus);

      // Progreso: 10%
      await job.updateProgress(10);

      // Subir archivo a S3
      this.logger.log(`Uploading file to S3 for document ${documentId}`);
      const s3Key = `documents/${documentId}.pdf`;
      await this.fileUploadService.uploadToS3(buffer, s3Key);
      await this.documentsRepository.update(documentId, { s3Key });

      // Progreso: 20%
      await job.updateProgress(20);

      // Extraer texto del PDF
      currentStatus = DocumentStatus.EXTRACTING;
      await this.updateDocumentStatus(documentId, currentStatus);
      this.logger.log(`Extracting text from PDF for document ${documentId}`);

      const extractedData = await this.pdfProcessorService.extractText(buffer);
      if (!extractedData?.text) {
        throw new Error('Failed to extract text from PDF');
      }

      // Progreso: 40%
      await job.updateProgress(40);

      // Dividir en chunks
      currentStatus = DocumentStatus.CHUNKING;
      await this.updateDocumentStatus(documentId, currentStatus);
      this.logger.log(`Creating chunks for document ${documentId}`);

      const chunks = await this.textChunkerService.createChunks(
        extractedData.text,
        extractedData.pageMapping || [],
      );

      if (!chunks || chunks.length === 0) {
        throw new Error('Failed to create chunks from document');
      }

      // Progreso: 60%
      await job.updateProgress(60);

      // Generar embeddings y guardar chunks
      await this.chunksService.processChunks(documentId, chunks);

      // Progreso: 80%
      await job.updateProgress(80);

      // Generar preguntas
      currentStatus = DocumentStatus.GENERATING_QUESTIONS;
      await this.updateDocumentStatus(documentId, currentStatus);
      this.logger.log(`Generating questions for document ${documentId}`);

      await this.questionsService.generateQuestionsForDocument(documentId);

      // Marcar como completado
      currentStatus = DocumentStatus.COMPLETED;
      await this.updateDocumentStatus(documentId, currentStatus);

      // Progreso: 100%
      await job.updateProgress(100);

      this.logger.log(`Document ${documentId} processing completed successfully`);
      return { success: true, documentId };
    } catch (error) {
      this.logger.error(`Error processing document ${documentId}:`, error);

      // Marcar como fallido con mensaje de error específico
      await this.updateDocumentStatus(
        documentId,
        DocumentStatus.FAILED,
        error.message
      );

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
}