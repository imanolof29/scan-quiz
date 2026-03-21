import { Module } from "@nestjs/common";
import { PdfProcessorService } from "./services/pdf-processor.service";
import { TextChunkerService } from "./services/text-chunker.service";

@Module({
    providers: [
        PdfProcessorService,
        TextChunkerService,
    ],
    exports: [
        PdfProcessorService,
        TextChunkerService,
    ]
})
export class CommonModule { }
