import { DocumentChunkEntity } from 'src/chunks/entity/document-chunk.entity';
import { QuestionEntity } from 'src/questions/entity/question.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

export enum DocumentStatus {
    UPLOADING = 'uploading',
    PROCESSING = 'processing',
    EXTRACTING = 'extracting',
    CHUNKING = 'chunking',
    GENERATING_QUESTIONS = 'generating_questions',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export enum Source {
    MANUAL = 'manual',
    AI = 'ai'
}


@Entity('documents')
export class DocumentEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ nullable: false })
    userId: string

    @Column()
    title: string

    @Column({ nullable: false })
    filename: string

    @Column({ nullable: true })
    s3Key: string

    @Column({
        type: 'enum',
        enum: DocumentStatus,
        default: DocumentStatus.UPLOADING
    })
    status: DocumentStatus

    @CreateDateColumn()
    createdAt: Date

    @OneToMany(() => DocumentChunkEntity, chunk => chunk.document)
    chunks: DocumentChunkEntity[]

    @OneToMany(() => QuestionEntity, question => question.document)
    questions: QuestionEntity[];

    @Column({ type: 'enum', enum: Source, default: Source.AI })
    source: Source;

}