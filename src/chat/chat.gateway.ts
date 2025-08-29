import { Injectable } from "@nestjs/common";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { OpenAIService } from "src/openai/openai.service";
import { ChatMessage, JoinConversation } from "./type/chat";
import { ChunkService } from "src/chunks/chunk.service";
import { ChatService } from "./chat.service";


@WebSocketGateway({
    cors: {
        credentials: true,
    },
    namespace: '/chat'
})
@Injectable()
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private userSockets = new Map<string, Socket>();

    constructor(
        private readonly chatService: ChatService,
        private readonly chunkService: ChunkService,
        private readonly openAIService: OpenAIService,
    ) { }

    async handleConnection(client: Socket) {
        try {
            // Extraer token del handshake
            const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];

            if (!token) {
                client.disconnect();
                return;
            }

            const userId = ""

            client.data.userId = userId;
            this.userSockets.set(userId, client);

            console.log(`Usuario ${userId} conectado al chat`);

        } catch (error) {
            console.error('Error en autenticación WebSocket:', error);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId;
        if (userId) {
            this.userSockets.delete(userId);
            console.log(`Usuario ${userId} desconectado del chat`);
        }
    }

    @SubscribeMessage('join_conversation')
    async handleJoinConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: JoinConversation
    ) {
        const userId = client.data.userId;

        try {
            const conversation = await this.chatService.getConversationById(
                data.conversationId,
                userId
            );

            client.join(data.conversationId);

            client.emit('joined_conversation', {
                conversationId: data.conversationId,
                conversation
            });

        } catch (error) {
            client.emit('error', {
                message: 'No se pudo unir a la conversación',
                error: error.message
            });
        }
    }

    @SubscribeMessage('send_message')
    async handleSendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: ChatMessage
    ) {
        const userId = client.data.userId;

        try {
            // Emitir que se recibió el mensaje
            this.server.to(data.conversationId).emit('message_received', {
                content: data.content,
                role: 'user',
                timestamp: new Date()
            });

            // Indicar que se está buscando información
            this.server.to(data.conversationId).emit('status_update', {
                status: 'searching',
                message: 'Buscando información relevante...'
            });

            // Buscar información relevante
            const conversation = await this.chatService.getConversationMeta(
                data.conversationId,
                userId
            );

            const searchResults = await this.chunkService.searchSimilarChunks(
                data.content,
                conversation.documentId,
                5,
                0.7
            );

            // Guardar mensaje del usuario
            await this.chatService.saveUserMessage(
                data.conversationId,
                data.content
            );

            // Indicar que se está generando respuesta
            this.server.to(data.conversationId).emit('status_update', {
                status: 'generating',
                message: 'Generando respuesta...',
                sources: searchResults.map(r => ({
                    pageNumber: r.chunk.pageNumber,
                    similarity: r.similarity
                }))
            });

            // Generar respuesta con streaming
            await this.streamAIResponse(
                data.conversationId,
                data.content,
                searchResults,
                conversation,
                userId
            );

        } catch (error) {
            console.error('Error procesando mensaje:', error);

            this.server.to(data.conversationId).emit('error', {
                message: 'Error procesando el mensaje',
                error: error.message
            });

            this.server.to(data.conversationId).emit('status_update', {
                status: 'error',
                message: 'Error procesando el mensaje'
            });
        }
    }

    private async streamAIResponse(
        conversationId: string,
        userMessage: string,
        searchResults: any[],
        conversation: any,
        userId: string
    ) {
        const relevantChunks = searchResults.map(result => result.chunk.content);
        const conversationHistory = await this.chatService.getRecentMessages(
            conversationId,
            10
        );

        // Preparar contexto
        const context = {
            relevantChunks,
            documentTitle: conversation.document.title,
            question: userMessage,
            conversationHistory
        };

        let fullResponse = '';
        const messageId = await this.chatService.createAssistantMessage(conversationId);

        try {
            // Stream de OpenAI
            const stream = await this.openAIService.generateChatResponseStream(context);

            this.server.to(conversationId).emit('response_start', {
                messageId,
                timestamp: new Date()
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';

                if (content) {
                    fullResponse += content;

                    // Emitir chunk en tiempo real
                    this.server.to(conversationId).emit('response_chunk', {
                        messageId,
                        content,
                        fullContent: fullResponse
                    });
                }
            }

            // Guardar respuesta completa
            await this.chatService.updateAssistantMessage(
                messageId,
                fullResponse
            );

            this.server.to(conversationId).emit('response_complete', {
                messageId,
                content: fullResponse,
                sources: searchResults.map(r => ({
                    chunkId: r.chunk.id,
                    pageNumber: r.chunk.pageNumber,
                    content: r.chunk.content,
                    similarity: r.similarity
                })),
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Error en streaming:', error);

            await this.chatService.updateAssistantMessage(
                messageId,
                'Lo siento, hubo un error generando la respuesta. Por favor, intenta de nuevo.',
            );

            this.server.to(conversationId).emit('response_error', {
                messageId,
                error: 'Error generando la respuesta'
            });
        }
    }
}