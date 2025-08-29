import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ConversationEntity } from './conversation.entity';

export enum MessageRole {
    USER = 'user',
    ASSISTANT = 'assistant'
}

@Entity('messages')
export class MessageEntity {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    conversationId: string;

    @Column({
        type: 'enum',
        enum: MessageRole
    })
    role: MessageRole

    @ManyToOne(() => ConversationEntity, conversation => conversation.messages)
    conversation: ConversationEntity;

    @Column('text')
    content: string;

    @CreateDateColumn()
    createdAt: Date;

}