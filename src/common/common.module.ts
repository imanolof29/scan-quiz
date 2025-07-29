import { Module } from "@nestjs/common";
import { FileUploadService } from "./services/file-upload.service";
import { PdfProcessorService } from "./services/pdf-processor.service";
import { TextChunkerService } from "./services/text-chunker.service";

@Module({
    providers: [
        FileUploadService,
        PdfProcessorService,
        TextChunkerService
    ],
    exports: [
        FileUploadService,
        PdfProcessorService,
        TextChunkerService
    ]
})
export class CommonModule { }