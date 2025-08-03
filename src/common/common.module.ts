import { Module } from "@nestjs/common";
import { FileUploadService } from "./services/file-upload.service";
import { PdfProcessorService } from "./services/pdf-processor.service";
import { TextChunkerService } from "./services/text-chunker.service";
import { Supabase } from "./services/supabase";

@Module({
    providers: [
        FileUploadService,
        PdfProcessorService,
        TextChunkerService,
        Supabase
    ],
    exports: [
        FileUploadService,
        PdfProcessorService,
        TextChunkerService,
        Supabase
    ]
})
export class CommonModule { }