import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { Auth } from "src/auth/decorator/auth.decorator";
import { CurrentUser } from "src/auth/decorator/user.decorator";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

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
    async getDocuments(
        @CurrentUser('id') userId: string,
    ) {
        return await this.documentsService.getDocuments(userId);
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    @ApiOperation({
        summary: 'Upload a document',
        description: 'Uploads a PDF document and generates questions from it.'
    })
    @ApiParam({
        name: 'file',
        description: 'The PDF file to upload',
        required: true,
        type: 'file'
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
            documentId: document.documentId,
            status: document.status,
            message: 'Document uploaded. Processing started.',
        };
    }

    @Get(':id/status')
    @ApiOperation({
        summary: 'Get document status',
        description: 'Retrieves the processing status of a specific document.'
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
    async getDocumentQuestions(
        @Param('id') id: string,
        @CurrentUser('id') userId: string
    ) {
        return await this.documentsService.getDocumentQuestions(id, userId);
    }
}