import { Injectable } from '@nestjs/common';

interface TextChunk {
    content: string;
    pageNumber: number;
    chunkIndex: number;
    tokenCount: number;
}

@Injectable()
export class TextChunkerService {
    private readonly CHUNK_SIZE = 1000;
    private readonly CHUNK_OVERLAP = 200;

    async createChunks(
        text: string,
        pageMapping: Array<{ pageNumber: number; startIndex: number; endIndex: number }>,
    ): Promise<TextChunk[]> {
        const chunks: TextChunk[] = [];
        let chunkIndex = 0;

        const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);

        let currentChunk = '';
        let currentPageNumber = 1;

        for (const paragraph of paragraphs) {
            const paragraphTokens = this.estimateTokens(paragraph);
            const currentTokens = this.estimateTokens(currentChunk);

            if (currentTokens + paragraphTokens > this.CHUNK_SIZE && currentChunk.length > 0) {
                chunks.push({
                    content: currentChunk.trim(),
                    pageNumber: currentPageNumber,
                    chunkIndex: chunkIndex++,
                    tokenCount: currentTokens,
                });

                currentChunk = this.createOverlap(currentChunk) + '\n\n' + paragraph;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }

            currentPageNumber = this.findPageNumber(
                text.indexOf(paragraph),
                pageMapping,
            );
        }

        if (currentChunk.trim().length > 0) {
            chunks.push({
                content: currentChunk.trim(),
                pageNumber: currentPageNumber,
                chunkIndex: chunkIndex++,
                tokenCount: this.estimateTokens(currentChunk),
            });
        }

        return chunks;
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    private createOverlap(text: string): string {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const overlapSentences = Math.min(2, sentences.length);

        return sentences
            .slice(-overlapSentences)
            .join('. ')
            .trim() + (overlapSentences > 0 ? '.' : '');
    }

    private findPageNumber(
        textIndex: number,
        pageMapping: Array<{ pageNumber: number; startIndex: number; endIndex: number }>,
    ): number {
        for (const page of pageMapping) {
            if (textIndex >= page.startIndex && textIndex <= page.endIndex) {
                return page.pageNumber;
            }
        }
        return 1;
    }
}
