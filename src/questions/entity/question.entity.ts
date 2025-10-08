import { DocumentEntity } from 'src/documents/entity/document.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';

@Entity('questions')
export class QuestionEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    question: string

    @Column('text', { array: true })
    options: string[]

    @Column()
    answerIndex: number

    @Column({ nullable: true })
    difficulty: string

    @Column({ nullable: true })
    questionType: string

    @Column('text', { array: true })
    sourceChunkIds: string[]

    @Column('text', { array: true })
    pageReferences: string[]

    @ManyToOne(() => DocumentEntity, (document) => document.questions)
    document: DocumentEntity
}