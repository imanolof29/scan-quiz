import { DocumentStatus } from "src/documents/entity/document.entity";


export type Step = {
    documentId: string;
    userId: string
    status: DocumentStatus;
    progress: number
    message: string
}