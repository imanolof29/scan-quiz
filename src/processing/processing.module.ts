import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProcessingService } from './processing.service';
import { ProcessingConsumer } from './processing.consumer';
import { CommonModule } from 'src/common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from 'src/documents/entity/document.entity';
import { OpenAIModule } from 'src/openai/openai.module';
import { ChunkModule } from 'src/chunks/chunk.module';
import { QuestionModule } from 'src/questions/question.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'document-processing',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    TypeOrmModule.forFeature([DocumentEntity]),
    CommonModule,
    OpenAIModule,
    ChunkModule,
    QuestionModule,
  ],
  providers: [ProcessingService, ProcessingConsumer],
  exports: [ProcessingService],
})
export class ProcessingModule {}