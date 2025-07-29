import { DocumentEntity } from 'src/documents/entity/document.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';

@Entity('questions')
export class QuestionEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    question: string

    @Column()
    options: string[]

    @Column()
    answerIndex: number

    @Column()
    difficulty: string

    @Column()
    questionType: string

    @Column()
    sourceChunkIds: string[]

    @Column()
    pageReferences: string[]

    @ManyToOne(() => DocumentEntity, (document) => document.questions)
    document: DocumentEntity
}