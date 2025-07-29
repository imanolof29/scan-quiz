import { Module } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { DocumentsController } from "./documents.controller";
import { AuthModule } from "src/auth/auth.module";
import { OpenAIModule } from "src/openai/openai.module";
import { CommonModule } from "src/common/common.module";

@Module({
    providers: [DocumentsService],
    controllers: [DocumentsController],
    imports: [AuthModule, CommonModule, OpenAIModule],
    exports: [DocumentsService],
})
export class DocumentsModule { }