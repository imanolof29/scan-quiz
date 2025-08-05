import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Request,
    UploadedFile,
    UseInterceptors
} from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { Auth } from "src/auth/decorator/auth.decorator";
import { CurrentUser } from "src/auth/decorator/user.decorator";
import { ApiOperation, ApiParam, ApiTags, ApiResponse } from "@nestjs/swagger";

@Controller('documents')
@Auth()
@ApiTags('Documents')
export class DocumentsController {
    constructor(private readonly documentsService: DocumentsService) { }

    @Get('find')
    @ApiOperation({
        summary: 'Get all documents',
        description: 'Retrieves all documents uploaded by the user.'
    })
    @ApiResponse({
        status: 200,
        description: 'List of documents retrieved successfully'
    })
    async getDocuments(
        @CurrentUser('id') userId: string,
    ) {
        return await this.documentsService.getDocuments(userId);
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    @ApiOperation({
        summary: 'Upload a document',
        description: 'Uploads a PDF document and starts the processing pipeline.'
    })
    @ApiParam({
        name: 'file',
        description: 'The PDF file to upload',
        required: true,
        type: 'file'
    })
    @ApiResponse({
        status: 201,
        description: 'Document uploaded successfully and processing started'
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid file or file too large'
    })
    async uploadDocument(
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser('id') userId: string
    ) {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        if (file.mimetype !== 'application/pdf') {
            throw new BadRequestException('Only PDF files are allowed');
        }

        if (file.size > 50 * 1024 * 1024) {
            throw new BadRequestException('File too large. Max size: 50MB');
        }

        const document = await this.documentsService.uploadAndProcess(
            file,
            userId
        );

        return {
            success: true,
            documentId: document.id,
            status: document.status,
            message: 'Document uploaded. Processing started.',
        };
    }

    @Get(':id/status')
    @ApiOperation({
        summary: 'Get document status',
        description: 'Retrieves the processing status and progress of a specific document.'
    })
    @ApiParam({
        name: 'id',
        description: 'Document ID',
        type: 'string'
    })
    @ApiResponse({
        status: 200,
        description: 'Document status retrieved successfully'
    })
    @ApiResponse({
        status: 404,
        description: 'Document not found'
    })
    async getDocumentStatus(
        @Param('id') id: string,
        @CurrentUser('id') userId: string
    ) {
        return await this.documentsService.getDocumentStatus(id, userId);
    }

    @Get(':id/questions')
    @ApiOperation({
        summary: 'Get document questions',
        description: 'Retrieves all questions generated from a specific document.'
    })
    @ApiParam({
        name: 'id',
        description: 'Document ID',
        type: 'string'
    })
    @ApiResponse({
        status: 200,
        description: 'Document questions retrieved successfully'
    })
    @ApiResponse({
        status: 400,
        description: 'Document is still processing or failed'
    })
    @ApiResponse({
        status: 404,
        description: 'Document not found'
    })
    async getDocumentQuestions(
        @Param('id') id: string,
        @CurrentUser('id') userId: string
    ) {
        return await this.documentsService.getDocumentQuestions(id, userId);
    }

    @Post(':id/retry')
    @ApiOperation({
        summary: 'Retry failed document processing',
        description: 'Restarts the processing pipeline for a failed document.'
    })
    @ApiParam({
        name: 'id',
        description: 'Document ID',
        type: 'string'
    })
    @ApiResponse({
        status: 200,
        description: 'Document processing restarted successfully'
    })
    @ApiResponse({
        status: 400,
        description: 'Only failed documents can be retried'
    })
    @ApiResponse({
        status: 404,
        description: 'Document not found'
    })
    async retryDocument(
        @Param('id') id: string,
        @CurrentUser('id') userId: string
    ) {
        return await this.documentsService.retryFailedDocument(id, userId);
    }

    @Post(':id/cancel')
    @ApiOperation({
        summary: 'Cancel document processing',
        description: 'Cancels the processing of a document that is currently being processed.'
    })
    @ApiParam({
        name: 'id',
        description: 'Document ID',
        type: 'string'
    })
    @ApiResponse({
        status: 200,
        description: 'Document processing cancelled successfully'
    })
    @ApiResponse({
        status: 400,
        description: 'Only processing documents can be cancelled'
    })
    @ApiResponse({
        status: 404,
        description: 'Document not found'
    })
    async cancelDocument(
        @Param('id') id: string,
        @CurrentUser('id') userId: string
    ) {
        return await this.documentsService.cancelDocumentProcessing(id, userId);
    }

    @Get('queue/stats')
    @ApiOperation({
        summary: 'Get queue statistics',
        description: 'Retrieves statistics about the document processing queues (admin endpoint).'
    })
    @ApiResponse({
        status: 200,
        description: 'Queue statistics retrieved successfully'
    })
    async getQueueStats() {
        return await this.documentsService.getQueueStats();
    }

    @Get(':id/progress')
    @ApiOperation({
        summary: 'Get document processing progress',
        description: 'Retrieves detailed progress information for a document being processed.'
    })
    @ApiParam({
        name: 'id',
        description: 'Document ID',
        type: 'string'
    })
    @ApiResponse({
        status: 200,
        description: 'Document progress retrieved successfully'
    })
    async getDocumentProgress(
        @Param('id') id: string,
        @CurrentUser('id') userId: string
    ) {
        const status = await this.documentsService.getDocumentStatus(id, userId);

        // Mapear el progreso a pasos más descriptivos
        let currentStep = 'started';
        let progress = status.jobInfo?.progress || 0;

        if (progress >= 25 && progress < 50) currentStep = 'extracting_pdf';
        else if (progress >= 50 && progress < 75) currentStep = 'chunking_text';
        else if (progress >= 75 && progress < 90) currentStep = 'generating_embeddings';
        else if (progress >= 90 && progress < 100) currentStep = 'generating_questions';
        else if (progress >= 100 || status.status === 'completed') currentStep = 'completed';

        return {
            ...status,
            currentStep,
            progress,
            steps: [
                {
                    key: 'started',
                    completed: progress > 0,
                    active: currentStep === 'started'
                },
                {
                    key: 'extracting_pdf',
                    completed: progress >= 50,
                    active: currentStep === 'extracting_pdf'
                },
                {
                    key: 'chunking_text',
                    completed: progress >= 75,
                    active: currentStep === 'chunking_text'
                },
                {
                    key: 'generating_embeddings',
                    completed: progress >= 90,
                    active: currentStep === 'generating_embeddings'
                },
                {
                    key: 'generating_questions',
                    completed: progress >= 100 || status.status === 'completed',
                    active: currentStep === 'generating_questions'
                },
                {
                    key: 'completed',
                    completed: status.status === 'completed',
                    active: currentStep === 'completed'
                }
            ]
        };
    }
}