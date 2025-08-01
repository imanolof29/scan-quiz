import { DocumentEntity } from 'src/documents/entity/document.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';

@Entity('document_chunks')
export class DocumentChunkEntity {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('text')
    content: string;

    @Column('real', { array: true })
    embedding: number[];

    @Column()
    pageNumber: number;

    @Column()
    chunkIndex: number;

    @Column()
    tokenCount: number;

    @ManyToOne(() => DocumentEntity, (document) => document.chunks)
    document: DocumentEntity;

}