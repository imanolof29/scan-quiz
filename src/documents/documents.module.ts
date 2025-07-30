import { Module } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { DocumentsController } from "./documents.controller";
import { AuthModule } from "src/auth/auth.module";
import { OpenAIModule } from "src/openai/openai.module";
import { CommonModule } from "src/common/common.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DocumentEntity } from "./entity/document.entity";
import { ChunkModule } from "src/chunks/chunk.module";
import { QuestionModule } from "src/questions/question.module";

@Module({
    providers: [DocumentsService],
    controllers: [DocumentsController],
    imports: [AuthModule, CommonModule, OpenAIModule, ChunkModule, QuestionModule, TypeOrmModule.forFeature([DocumentEntity])],
    exports: [DocumentsService],
})
export class DocumentsModule { }