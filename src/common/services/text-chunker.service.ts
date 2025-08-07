import { Injectable } from "@nestjs/common";

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
    private readonly MIN_CHUNK_SIZE = 100;

    async createChunks(
        text: string,
        pageMapping: Array<{ pageNumber: number; startIndex: number; endIndex: number }>,
    ): Promise<TextChunk[]> {
        if (!text || text.trim().length === 0) {
            throw new Error('Text is empty or invalid');
        }

        const chunks: TextChunk[] = [];
        let chunkIndex = 0;

        const sentences = this.splitIntoSentences(text);

        if (sentences.length === 0) {
            throw new Error('No sentences found in text');
        }

        let currentChunk = '';
        let currentTokens = 0;

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            const sentenceTokens = this.estimateTokens(sentence);

            if (sentenceTokens > this.CHUNK_SIZE) {
                if (currentChunk.trim().length > 0) {
                    const pageNumber = this.findPageNumber(
                        text.indexOf(currentChunk.substring(0, 100)),
                        pageMapping
                    );

                    chunks.push({
                        content: currentChunk.trim(),
                        pageNumber,
                        chunkIndex: chunkIndex++,
                        tokenCount: currentTokens,
                    });
                }

                const sentenceChunks = this.splitLargeSentence(sentence, text, pageMapping, chunkIndex);
                chunks.push(...sentenceChunks);
                chunkIndex += sentenceChunks.length;

                currentChunk = '';
                currentTokens = 0;
                continue;
            }

            if (currentTokens + sentenceTokens > this.CHUNK_SIZE && currentChunk.length > 0) {
                const pageNumber = this.findPageNumber(
                    text.indexOf(currentChunk.substring(0, 100)),
                    pageMapping
                );

                chunks.push({
                    content: currentChunk.trim(),
                    pageNumber,
                    chunkIndex: chunkIndex++,
                    tokenCount: currentTokens,
                });

                const overlapText = this.createSentenceOverlap(currentChunk);
                currentChunk = overlapText + (overlapText ? ' ' : '') + sentence;
                currentTokens = this.estimateTokens(currentChunk);
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
                currentTokens += sentenceTokens;
            }
        }

        if (currentChunk.trim().length > 0 && currentTokens >= this.MIN_CHUNK_SIZE) {
            const pageNumber = this.findPageNumber(
                text.indexOf(currentChunk.substring(0, 100)),
                pageMapping
            );

            chunks.push({
                content: currentChunk.trim(),
                pageNumber,
                chunkIndex: chunkIndex++,
                tokenCount: currentTokens,
            });
        }

        if (chunks.length === 0) {
            throw new Error('No valid chunks were created from the text');
        }

        console.log(`Created ${chunks.length} chunks from text of ${text.length} characters`);
        return chunks;
    }

    private splitIntoSentences(text: string): string[] {
        const sentences = text
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().length > 0)
            .map(s => s.trim());

        if (sentences.length <= 1) {
            return text
                .split(/\n\s*\n/)
                .filter(p => p.trim().length > 0)
                .map(p => p.replace(/\s+/g, ' ').trim());
        }

        return sentences;
    }

    private splitLargeSentence(
        sentence: string,
        fullText: string,
        pageMapping: Array<{ pageNumber: number; startIndex: number; endIndex: number }>,
        startChunkIndex: number
    ): TextChunk[] {
        const chunks: TextChunk[] = [];
        const words = sentence.split(/\s+/);
        const targetWordsPerChunk = Math.floor(this.CHUNK_SIZE / 4);

        let currentChunk = '';
        let chunkIndex = startChunkIndex;

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const testChunk = currentChunk + (currentChunk ? ' ' : '') + word;

            if (this.estimateTokens(testChunk) > this.CHUNK_SIZE && currentChunk.length > 0) {
                const pageNumber = this.findPageNumber(
                    fullText.indexOf(currentChunk.substring(0, 50)),
                    pageMapping
                );

                chunks.push({
                    content: currentChunk.trim(),
                    pageNumber,
                    chunkIndex: chunkIndex++,
                    tokenCount: this.estimateTokens(currentChunk),
                });

                currentChunk = word;
            } else {
                currentChunk = testChunk;
            }
        }

        if (currentChunk.trim().length > 0) {
            const pageNumber = this.findPageNumber(
                fullText.indexOf(currentChunk.substring(0, 50)),
                pageMapping
            );

            chunks.push({
                content: currentChunk.trim(),
                pageNumber,
                chunkIndex: chunkIndex++,
                tokenCount: this.estimateTokens(currentChunk),
            });
        }

        return chunks;
    }

    private estimateTokens(text: string): number {
        const charCount = text.length;
        const wordCount = text.split(/\s+/).length;

        return Math.ceil((charCount / 4 + wordCount * 1.3) / 2);
    }

    private createSentenceOverlap(text: string): string {
        const sentences = this.splitIntoSentences(text);
        const overlapSentenceCount = Math.min(2, sentences.length);

        if (overlapSentenceCount === 0) {
            return '';
        }

        const overlapSentences = sentences.slice(-overlapSentenceCount);
        const overlapText = overlapSentences.join(' ');

        if (this.estimateTokens(overlapText) > this.CHUNK_OVERLAP) {
            return sentences[sentences.length - 1] || '';
        }

        return overlapText;
    }

    private findPageNumber(
        textIndex: number,
        pageMapping: Array<{ pageNumber: number; startIndex: number; endIndex: number }>,
    ): number {
        if (!pageMapping || pageMapping.length === 0) {
            return 1;
        }

        for (const page of pageMapping) {
            if (textIndex >= page.startIndex && textIndex < page.endIndex) {
                return page.pageNumber;
            }
        }

        return pageMapping[pageMapping.length - 1]?.pageNumber || 1;
    }
}