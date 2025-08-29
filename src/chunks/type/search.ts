import { DocumentChunkEntity } from "../entity/document-chunk.entity";

export interface SearchResult {
    chunk: DocumentChunkEntity;
    similarity: number;
}