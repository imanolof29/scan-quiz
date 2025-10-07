import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { DocumentsService } from "./documents.service";
import { DocumentsController } from "./documents.controller";
import { AuthModule } from "src/auth/auth.module";
import { OpenAIModule } from "src/openai/openai.module";
import { CommonModule } from "src/common/common.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DocumentEntity } from "./entity/document.entity";
import { ChunkModule } from "src/chunks/chunk.module";
import { QuestionModule } from "src/questions/question.module";
import { ProcessingModule } from "src/processing/processing.module";
import { DocumentProcessingGateway } from "./documents.gateway";
import { NotificationsModule } from "src/notifications/notifications.module";

@Module({
    providers: [DocumentsService, DocumentProcessingGateway],
    controllers: [DocumentsController],
    imports: [
        AuthModule,
        CommonModule,
        OpenAIModule,
        ChunkModule,
        QuestionModule,
        TypeOrmModule.forFeature([DocumentEntity]),
        forwardRef(() => ProcessingModule),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: '1h' },
            }),
            inject: [ConfigService],
        }),
        NotificationsModule
    ],
    exports: [DocumentsService, DocumentProcessingGateway],
})
export class DocumentsModule { }