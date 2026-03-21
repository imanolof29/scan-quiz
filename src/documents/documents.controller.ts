import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { Auth } from "src/auth/decorator/auth.decorator";
import { CurrentUser } from "src/auth/decorator/user.decorator";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CreateManualDocumentDto } from "./dto/create-manual-document.dto";

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

    @Post('manual')
    async createManualDocument(
        @CurrentUser('id') userId: string,
        @Body() dto: CreateManualDocumentDto
    ): Promise<void> {
        await this.documentsService.createManualDocument(userId, dto);
    }

    @Delete(':id')
    @ApiOperation({
        summary: 'Delete a document',
        description: 'Deletes a specific document and all its associated data.'
    })
    async deleteDocument(
        @Param('id') id: string,
        @CurrentUser('id') userId: string
    ) {
        await this.documentsService.deleteDocument(id, userId);
        return { success: true, message: 'Document deleted successfully' };
    }

}