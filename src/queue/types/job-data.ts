export interface ProcessDocumentJobData {
    documentId: string;
    userId: string;
    fileName: string;
    s3Key: string;
}

export interface ExtractPdfJobData {
    documentId: string
    userId: string
    s3Key: string;
}

export interface ChunkingJobData {
    documentId: string
    userId: string
    extractedText: string;
    pageMapping: any[];
}

export interface EmbeddingJobData {
    documentId: string
    userId: string;
    chunks: Array<{
        content: string;
        pageNumber: number;
        chunkIndex: number;
        tokenCount: number;
    }>;
}

export interface QuestionJobData {
    documentId: string;
    userId: string;
}

export interface NotificationJobData {
    userId: string;
    documentId: string;
    type: 'progress' | 'completed' | 'failed';
    step?: string;
    progress?: number;
    error?: string;
}