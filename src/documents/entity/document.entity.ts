import { DocumentChunkEntity } from 'src/chunks/entity/document-chunk.entity';
import { QuestionEntity } from 'src/questions/entity/question.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';


@Entity('documents')
export class DocumentEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    title: string

    @Column()
    filename: string

    @Column({ nullable: true })
    s3Key: string

    @Column()
    status: string

    @CreateDateColumn()
    createdAt: Date

    @OneToMany(() => DocumentChunkEntity, chunk => chunk.document)
    chunks: DocumentChunkEntity[]

    @OneToMany(() => QuestionEntity, question => question.document)
    questions: QuestionEntity[]

}