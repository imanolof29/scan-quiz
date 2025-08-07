
import { Injectable } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';

interface ExtractedData {
    text: string;
    totalPages: number;
    pageMapping: Array<{ pageNumber: number; startIndex: number; endIndex: number }>;
}

@Injectable()
export class PdfProcessorService {
    async extractText(buffer: Buffer): Promise<ExtractedData> {
        try {
            const data = await pdfParse(buffer, {
                normalizeWhitespace: true,
                disableCombineTextItems: false,
            });

            const cleanText = this.cleanText(data.text);

            const pageMapping = await this.createAdvancedPageMapping(buffer, cleanText, data.numpages);

            return {
                text: cleanText,
                totalPages: data.numpages,
                pageMapping,
            };
        } catch (error) {
            throw new Error(`Failed to process PDF: ${error.message}`);
        }
    }

    private cleanText(text: string): string {
        return text
            .replace(/[ \t]+/g, ' ')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[^\w\s\.\,\!\?\;\:\-\(\)\"\'\[\]]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private async createAdvancedPageMapping(buffer: Buffer, text: string, totalPages: number) {
        const pageMapping: any[] = [];

        try {
            const pageTexts = await this.extractTextByPage(buffer, totalPages);

            if (pageTexts && pageTexts.length === totalPages) {
                let currentIndex = 0;

                for (let i = 0; i < totalPages; i++) {
                    const pageText = this.cleanText(pageTexts[i]);
                    const pageLength = pageText.length;

                    pageMapping.push({
                        pageNumber: i + 1,
                        startIndex: currentIndex,
                        endIndex: currentIndex + pageLength,
                    });

                    currentIndex += pageLength;
                }

                return pageMapping;
            }
        } catch (error) {
            console.warn('Page-by-page extraction failed, using approximation');
        }

        return this.createApproximatePageMapping(text, totalPages);
    }

    private async extractTextByPage(buffer: Buffer, totalPages: number): Promise<string[]> {
        const pageTexts: string[] = [];

        try {
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const pageOptions = {
                    first: pageNum,
                    last: pageNum,
                };

                const pageData = await pdfParse(buffer, pageOptions);
                pageTexts.push(pageData.text || '');
            }

            return pageTexts;
        } catch (error) {
            throw error;
        }
    }

    private createApproximatePageMapping(text: string, totalPages: number) {
        const pageMapping: any[] = [];
        const textLength = text.length;
        const averagePageLength = Math.floor(textLength / totalPages);

        for (let i = 0; i < totalPages; i++) {
            const startIndex = i * averagePageLength;
            const endIndex = i === totalPages - 1 ? textLength : (i + 1) * averagePageLength;

            pageMapping.push({
                pageNumber: i + 1,
                startIndex,
                endIndex,
            });
        }

        return pageMapping;
    }
}