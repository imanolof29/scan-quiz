import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConversationEntity } from "./entity/conversation.entity";
import { MessageEntity } from "./entity/message.entity";
import { DocumentEntity } from "src/documents/entity/document.entity";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { ChunkModule } from "src/chunks/chunk.module";
import { OpenAIModule } from "src/openai/openai.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ConversationEntity,
            MessageEntity,
            DocumentEntity
        ]),
        ChunkModule,
        OpenAIModule
    ],
    providers: [
        ChatGateway,
        ChatService
    ],
    exports: [ChatService]
})
export class ChatModule { }