import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { QuestionEntity } from "./entity/question.entity";
import { QuestionsService } from "./question.service";
import { OpenAIModule } from "src/openai/openai.module";
import { ChunkModule } from "src/chunks/chunk.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([QuestionEntity]),
        OpenAIModule,
        ChunkModule
    ],
    providers: [QuestionsService],
    exports: [QuestionsService]
})
export class QuestionModule { }