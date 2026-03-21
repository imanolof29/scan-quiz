import { DocumentChunkEntity } from 'src/chunks/entity/document-chunk.entity';
import { QuestionEntity } from 'src/questions/entity/question.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

export enum DocumentStatus {
    PROCESSING = 'processing',
    EXTRACTING = 'extracting',
    CHUNKING = 'chunking',
    GENERATING_QUESTIONS = 'generating_questions',
    COMPLETED = 'completed',
    FAILED = 'failed'
}


@Entity('documents')
export class DocumentEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ nullable: false })
    userId: string

    @Column()
    title: string

    @Column({ nullable: true })
    filename: string

    @Column({ nullable: true })
    s3Key: string

    @Column({
        type: 'enum',
        enum: DocumentStatus,
        default: DocumentStatus.PROCESSING
    })
    status: DocumentStatus

    @CreateDateColumn()
    createdAt: Date

    @OneToMany(() => DocumentChunkEntity, chunk => chunk.document, {
        cascade: true,
        onDelete: 'CASCADE'
    })
    chunks: DocumentChunkEntity[]

    @OneToMany(() => QuestionEntity, question => question.document, {
        cascade: true,
        onDelete: 'CASCADE'
    })
    questions: QuestionEntity[];

}