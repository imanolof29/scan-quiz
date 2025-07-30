import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DocumentChunkEntity } from "./entity/document-chunk.entity";
import { Repository } from 'typeorm';
import { OpenAIService } from "src/openai/openai.service";

@Injectable()
export class ChunkService {

    constructor(
        @InjectRepository(DocumentChunkEntity)
        private readonly chunkRepository: Repository<DocumentChunkEntity>,
        private readonly openaiService: OpenAIService,
    ) { }

    async findChunksByDocumentId(documentId: string): Promise<DocumentChunkEntity[]> {
        return this.chunkRepository.find({ where: { document: { id: documentId } } });
    }

    async processChunks(documentId: string, chunks: any[]) {
        const processedChunks: DocumentChunkEntity[] = [];

        for (const chunk of chunks) {
            try {
                const embedding = await this.openaiService.generateEmbedding(chunk.content);

                const documentChunk = this.chunkRepository.create({
                    content: chunk.content,
                    embedding,
                    pageNumber: chunk.pageNumber,
                    chunkIndex: chunk.chunkIndex,
                    tokenCount: chunk.tokenCount,
                    document: { id: documentId },
                });

                processedChunks.push(documentChunk);
            } catch (error) {
                console.error(`Error processing chunk ${chunk.chunkIndex}:`, error);
            }
        }

        await this.chunkRepository.save(processedChunks);
        return processedChunks;
    }

}