export const QUEUE_NAMES = {
    DOCUMENT_PROCESSING: 'document_processing',
    PDF_EXTRACTION: 'pdf_extraction',
    TEXT_CHUNKING: 'text_chunking',
    EMBEDDING_GENERATION: 'embedding_generation',
    QUESTION_GENERATION: 'question_generation',
    NOTIFICATION: 'notification',
} as const;

export const JOB_TYPES = {
    PROCESS_DOCUMENT: 'process_document',
    EXTRACT_PDF_TEXT: 'extract_pdf_text',
    CREATE_CHUNKS: 'create_chunks',
    GENERATE_EMBEDDINGS: 'generate_embeddings',
    GENERATE_QUESTIONS: 'generate_questions',
    SEND_NOTIFICATION: 'send_notification',
    CLEANUP_FAILED: 'cleanup_failed',
} as const;