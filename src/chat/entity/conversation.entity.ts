import { DocumentEntity } from 'src/documents/entity/document.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { MessageEntity } from './message.entity';

@Entity('conversations')
export class ConversationEntity {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: false })
    userId: string;

    @Column()
    documentId: string;

    @Column({ nullable: true })
    title: string;

    @OneToMany(() => MessageEntity, message => message.conversation)
    messages: MessageEntity[];

    @ManyToOne(() => DocumentEntity)
    @JoinColumn({ name: 'documentId' })
    document: DocumentEntity;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

}