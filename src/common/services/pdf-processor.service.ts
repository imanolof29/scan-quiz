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
            const data = await pdfParse(buffer);

            // Limpiar texto
            const cleanText = this.cleanText(data.text);

            // Crear mapeo de páginas (aproximado)
            const pageMapping = this.createPageMapping(cleanText, data.numpages);

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
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .replace(/[^\w\s\.\,\!\?\;\:\-\(\)]/g, '')
            .trim();
    }

    private createPageMapping(text: string, totalPages: number) {
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