import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { QuestionEntity } from "./entity/question";

@Module({
    imports: [
        TypeOrmModule.forFeature([QuestionEntity])
    ],
    providers: [],
    exports: []
})
export class QuestionModule { }