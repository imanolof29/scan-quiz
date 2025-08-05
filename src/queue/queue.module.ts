import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DocumentChunkEntity } from "src/chunks/entity/document-chunk.entity";
import { DocumentEntity } from "src/documents/entity/document.entity";
import { QuestionEntity } from "src/questions/entity/question.entity";
import { QUEUE_NAMES } from "./queue.constants";
import { DocumentOrchestratorProcessor } from "./processors/document-orchestrator.processor";
import { PdfExtractionProcessor } from "./processors/pdf-extraction.processor";
import { TextChunkingProcessor } from "./processors/text-chunking.processor";
import { EmbeddingGenerationProcessor } from "./processors/embedding-generator.processor";
import { QuestionGenerationProcessor } from "./processors/question-generation.processor";
import { NotificationProcessor } from "./processors/notification.processor";
import { PdfProcessorService } from "src/common/services/pdf-processor.service";
import { TextChunkerService } from "src/common/services/text-chunker.service";
import { FileUploadService } from "src/common/services/file-upload.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ChunkModule } from "src/chunks/chunk.module";
import { QuestionModule } from "src/questions/question.module";

@Module({
    imports: [
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                connection: {
                    host: configService.get<string>('BULLMQ_HOST'),
                    port: configService.get<number>('BULLMQ_PORT'),
                },
            }),
            inject: [ConfigService],
        }),
        EventEmitterModule.forRoot(),
        BullModule.registerQueue(
            { name: QUEUE_NAMES.DOCUMENT_PROCESSING },
            { name: QUEUE_NAMES.PDF_EXTRACTION },
            { name: QUEUE_NAMES.TEXT_CHUNKING },
            { name: QUEUE_NAMES.EMBEDDING_GENERATION },
            { name: QUEUE_NAMES.QUESTION_GENERATION },
            { name: QUEUE_NAMES.NOTIFICATION },
        ),
        TypeOrmModule.forFeature([
            DocumentEntity,
            DocumentChunkEntity,
            QuestionEntity
        ]),
        ChunkModule,
        QuestionModule
    ],
    providers: [
        //Processors
        DocumentOrchestratorProcessor,
        PdfExtractionProcessor,
        TextChunkingProcessor,
        EmbeddingGenerationProcessor,
        QuestionGenerationProcessor,
        NotificationProcessor,
        //Services
        PdfProcessorService,
        TextChunkerService,
        FileUploadService,
    ],
    exports: [
        BullModule,
        EventEmitterModule
    ]
})
export class QueueModule { }