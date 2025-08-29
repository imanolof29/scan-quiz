import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from 'typeorm';
import { ConversationEntity } from "./entity/conversation.entity";
import { MessageEntity, MessageRole } from "./entity/message.entity";
import { DocumentEntity, DocumentStatus } from "src/documents/entity/document.entity";

@Injectable()
export class ChatService {

    constructor(
        @InjectRepository(ConversationEntity)
        private readonly conversationRepository: Repository<ConversationEntity>,

        @InjectRepository(MessageEntity)
        private readonly messageRepository: Repository<MessageEntity>,

        @InjectRepository(DocumentEntity)
        private readonly documentRepository: Repository<DocumentEntity>
    ) { }

    async createConversation(
        userId: string,
        createConversationDto: any
    ): Promise<any> {
        const document = await this.documentRepository.findOne({
            where: {
                id: createConversationDto.documentId,
                userId
            }
        });

        if (!document) {
            throw new NotFoundException(`Documento no encontrado: ${createConversationDto.documentId}`);
        }

        if (document.status !== DocumentStatus.COMPLETED) {
            throw new BadRequestException('El documento aún no ha sido procesado completamente.');
        }

        const conversation = this.conversationRepository.create({
            userId,
            documentId: createConversationDto.documentId,
            title: createConversationDto.title || 'Nueva conversación'
        });

        const savedConversation = await this.conversationRepository.save(conversation);
        return savedConversation;
    }

    async getConversationById(conversationId: string, userId: string): Promise<ConversationEntity> {
        const conversation = await this.conversationRepository.findOne({
            where: {
                id: conversationId,
                userId
            },
            relations: ['messages', 'document']
        });

        if (!conversation) {
            throw new NotFoundException(`Conversación no encontrada: ${conversationId}`);
        }

        return conversation;
    }

    async getConversation(
        conversationId: string,
        userId: string
    ): Promise<any> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId, userId },
            relations: ['messages'],
            order: {
                messages: {
                    createdAt: 'ASC'
                }
            }
        });

        if (!conversation) {
            throw new NotFoundException('Conversación no encontrada');
        }

        return conversation;
    }

    // Método requerido por el ChatGateway
    async getConversationMeta(conversationId: string, userId: string): Promise<any> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId, userId },
            relations: ['document']
        });

        if (!conversation) {
            throw new NotFoundException('Conversación no encontrada');
        }

        return conversation;
    }

    // Guardar mensaje del usuario
    async saveUserMessage(conversationId: string, content: string): Promise<MessageEntity> {
        // Verificar que la conversación existe
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId }
        });

        if (!conversation) {
            throw new NotFoundException('Conversación no encontrada');
        }

        const userMessage = this.messageRepository.create({
            conversationId,
            role: MessageRole.USER,
            content,
        });

        return await this.messageRepository.save(userMessage);
    }

    // Obtener mensajes recientes para contexto
    async getRecentMessages(conversationId: string, limit: number = 10): Promise<any[]> {
        const messages = await this.messageRepository.find({
            where: { conversationId },
            order: { createdAt: 'DESC' },
            take: limit
        });

        // Devolver en orden cronológico para el contexto
        return messages.reverse().map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
        }));
    }

    // Crear mensaje del asistente (placeholder para streaming)
    async createAssistantMessage(conversationId: string): Promise<string> {
        const assistantMessage = this.messageRepository.create({
            conversationId,
            role: MessageRole.ASSISTANT,
            content: '', // Se actualizará después con el streaming
        });

        const saved = await this.messageRepository.save(assistantMessage);
        return saved.id;
    }

    // Actualizar mensaje del asistente con contenido final
    async updateAssistantMessage(
        messageId: string,
        content: string
    ): Promise<void> {
        await this.messageRepository.update(messageId, {
            content,
        });
    }

    // Obtener todas las conversaciones de un usuario
    async getUserConversations(
        userId: string,
        documentId?: string
    ): Promise<ConversationEntity[]> {
        const whereConditions: any = { userId };

        if (documentId) {
            whereConditions.documentId = documentId;
        }

        return await this.conversationRepository.find({
            where: whereConditions,
            relations: ['document'],
            order: { updatedAt: 'DESC' }
        });
    }

    // Eliminar conversación
    async deleteConversation(conversationId: string, userId: string): Promise<void> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId, userId }
        });

        if (!conversation) {
            throw new NotFoundException('Conversación no encontrada');
        }

        await this.conversationRepository.remove(conversation);
    }

    // Actualizar título de conversación
    async updateConversationTitle(
        conversationId: string,
        userId: string,
        title: string
    ): Promise<void> {
        const result = await this.conversationRepository.update(
            { id: conversationId, userId },
            { title }
        );

        if (result.affected === 0) {
            throw new NotFoundException('Conversación no encontrada');
        }
    }

    // Obtener estadísticas de una conversación
    async getConversationStats(conversationId: string, userId: string): Promise<any> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId, userId },
            relations: ['messages']
        });

        if (!conversation) {
            throw new NotFoundException('Conversación no encontrada');
        }

        const totalMessages = conversation.messages.length;
        const userMessages = conversation.messages.filter(m => m.role === MessageRole.USER).length;
        const assistantMessages = conversation.messages.filter(m => m.role === MessageRole.ASSISTANT).length;

        return {
            totalMessages,
            userMessages,
            assistantMessages,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt
        };
    }

    // Buscar conversaciones por contenido
    async searchConversations(
        userId: string,
        searchTerm: string,
        limit: number = 10
    ): Promise<ConversationEntity[]> {
        return await this.conversationRepository
            .createQueryBuilder('conversation')
            .leftJoinAndSelect('conversation.messages', 'message')
            .leftJoinAndSelect('conversation.document', 'document')
            .where('conversation.userId = :userId', { userId })
            .andWhere(
                '(conversation.title ILIKE :searchTerm OR message.content ILIKE :searchTerm)',
                { searchTerm: `%${searchTerm}%` }
            )
            .orderBy('conversation.updatedAt', 'DESC')
            .limit(limit)
            .getMany();
    }

    // Verificar si el usuario tiene acceso a la conversación
    async verifyUserAccess(conversationId: string, userId: string): Promise<boolean> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId, userId }
        });

        return !!conversation;
    }

    // Obtener el último mensaje de una conversación
    async getLastMessage(conversationId: string): Promise<MessageEntity | null> {
        return await this.messageRepository.findOne({
            where: { conversationId },
            order: { createdAt: 'DESC' }
        });
    }

    // Marcar conversación como actualizada (para ordenamiento)
    async touchConversation(conversationId: string): Promise<void> {
        await this.conversationRepository.update(
            conversationId,
            { updatedAt: new Date() }
        );
    }

    // Obtener conversaciones con paginación
    async getConversationsWithPagination(
        userId: string,
        page: number = 1,
        limit: number = 20
    ): Promise<{ conversations: ConversationEntity[], total: number, totalPages: number }> {
        const [conversations, total] = await this.conversationRepository.findAndCount({
            where: { userId },
            relations: ['document'],
            order: { updatedAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit
        });

        const totalPages = Math.ceil(total / limit);

        return {
            conversations,
            total,
            totalPages
        };
    }
}