import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DocumentChunkEntity } from "./entity/document-chunk.entity";
import { ChunkService } from "./chunk.service";
import { OpenAIModule } from "src/openai/openai.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([DocumentChunkEntity]),
        OpenAIModule
    ],
    providers: [ChunkService],
    exports: [ChunkService]
})
export class ChunkModule { }