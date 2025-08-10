import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QuestionModule } from './questions/question.module';
import { OpenAIModule } from './openai/openai.module';
import { CommonModule } from './common/common.module';
import { DocumentsModule } from './documents/documents.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from './documents/entity/document.entity';
import { QuestionEntity } from './questions/entity/question.entity';
import { DocumentChunkEntity } from './chunks/entity/document-chunk.entity';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [DocumentEntity, QuestionEntity, DocumentChunkEntity],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    OpenAIModule,
    QuestionModule,
    CommonModule,
    DocumentsModule,
    HealthModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
