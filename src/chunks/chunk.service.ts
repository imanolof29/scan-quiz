import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DocumentChunkEntity } from "./entity/document-chunk.entity";
import { Repository } from 'typeorm';
import { OpenAIService } from "src/openai/openai.service";
import { SearchResult } from "./type/search";

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

    async searchSimilarChunks(
        query: string,
        documentId: string,
        limit: number = 5,
        threshold: number = 0.7
    ): Promise<SearchResult[]> {
        const queryEmbedding = await this.openaiService.generateEmbedding(query);

        const chunks = await this.chunkRepository.find({
            where: { document: { id: documentId } },
            select: ['id', 'content', 'pageNumber', 'chunkIndex', 'embedding']
        });

        if (chunks.length === 0) {
            return [];
        }

        const results: SearchResult[] = [];

        for (const chunk of chunks) {
            if (!chunk.embedding) {
                continue;
            }

            const similarity = this.calculateCosineSimilarity(queryEmbedding, chunk.embedding);

            if (similarity >= threshold) {
                results.push({
                    chunk,
                    similarity
                });
            }
        }

        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
        if (vectorA.length !== vectorB.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

        if (magnitude === 0) {
            return 0;
        }

        return dotProduct / magnitude;
    }

}