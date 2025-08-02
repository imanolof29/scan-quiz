import { BadRequestException, Body, Controller, Get, Param, Post, Request, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtGuard } from "src/auth/guard/jwt.guard";

@Controller('documents')
export class DocumentsController {
    constructor(private readonly documentsService: DocumentsService) { }

    @Get('find')
    async getDocuments() {
        return await this.documentsService.getDocuments();
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadDocument(
        @UploadedFile() file: Express.Multer.File,
        @Body('generateQuestions') generateQuestions: string = 'true',
        @Request() req,
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

        const shouldGenerateQuestions = generateQuestions === 'true';

        const document = await this.documentsService.uploadAndProcess(
            file,
            "userId",
            shouldGenerateQuestions,
        );

        return {
            success: true,
            documentId: document.id,
            status: document.status,
            message: 'Document uploaded. Processing started.',
        };
    }

    @Get(':id/status')
    async getDocumentStatus(@Param('id') id: string, @Request() req) {
        const userId = req.user.id;
        return await this.documentsService.getDocumentStatus(id, userId);
    }

    @Get(':id/questions')
    async getDocumentQuestions(@Param('id') id: string, @Request() req) {
        return await this.documentsService.getDocumentQuestions(id, "");
    }
}