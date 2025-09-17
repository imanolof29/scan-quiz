import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Supabase } from 'src/common/services/supabase';

interface AuthenticatedSocket extends Socket {
    userId?: string;
}

@WebSocketGateway({
    cors: {
        origin: '*',
        credentials: true,
    },
    namespace: '/document-processing',
})
export class DocumentProcessingGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(DocumentProcessingGateway.name);
    private userSockets = new Map<string, string>();

    constructor(
        private readonly supabase: Supabase
    ) { }

    async handleConnection(client: AuthenticatedSocket) {
        try {
            // Extraer token del handshake
            const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');

            console.log("TOKEN RECIBIDO EN GATEWAY:", token);

            if (!token) {
                this.logger.warn(`Client ${client.id} connected without token`);
                client.disconnect();
                return;
            }

            // Verificar el token
            const { data, error } = await this.supabase.getClient().auth.getUser(token);

            if (error) {
                throw error;
            }

            client.userId = data.user?.id;
            this.userSockets.set(data.user.id ?? '', client.id);

            this.logger.log(`User ${client.userId} connected with socket ${client.id}`);

            // Confirmar conexión al cliente
            client.emit('connection-established', {
                message: 'Successfully connected to document processing notifications',
                userId: client.userId,
            });

        } catch (error) {
            console.log('Error authenticating WebSocket connection:', error);
            client.disconnect();
        }
    }

    handleDisconnect(client: AuthenticatedSocket) {
        if (client.userId) {
            this.userSockets.delete(client.userId);
            this.logger.log(`User ${client.userId} disconnected`);
        }
    }

    @SubscribeMessage('join-document-room')
    handleJoinDocumentRoom(
        @MessageBody() data: { documentId: string },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        if (!client.userId) return;

        const roomName = `document-${data.documentId}`;
        client.join(roomName);

        this.logger.log(`User ${client.userId} joined room ${roomName}`);

        client.emit('joined-document-room', {
            documentId: data.documentId,
            message: 'Successfully joined document processing room',
        });
    }

    @SubscribeMessage('leave-document-room')
    handleLeaveDocumentRoom(
        @MessageBody() data: { documentId: string },
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        if (!client.userId) return;

        const roomName = `document-${data.documentId}`;
        client.leave(roomName);

        this.logger.log(`User ${client.userId} left room ${roomName}`);
    }

    // Métodos para enviar notificaciones desde el procesador
    async notifyDocumentStatusUpdate(
        documentId: string,
        userId: string,
        status: string,
        progress?: number,
        message?: string,
    ) {
        const roomName = `document-${documentId}`;

        const notification = {
            documentId,
            status,
            progress,
            message,
            timestamp: new Date().toISOString(),
        };

        // Enviar a la room del documento
        this.server.to(roomName).emit('document-status-update', notification);

        // También enviar directamente al usuario si está conectado
        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('document-status-update', notification);
        }

        this.logger.log(`Status update sent for document ${documentId}: ${status}`);
    }

    async notifyDocumentCompleted(
        documentId: string,
        userId: string,
        data: {
            questionsCount: number;
            processingTime: number;
            title: string;
        },
    ) {
        const notification = {
            documentId,
            status: 'completed',
            progress: 100,
            message: 'Document processing completed successfully',
            data,
            timestamp: new Date().toISOString(),
        };

        // Enviar notificación de completado
        const roomName = `document-${documentId}`;
        this.server.to(roomName).emit('document-completed', notification);

        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('document-completed', notification);
        }

        this.logger.log(`Completion notification sent for document ${documentId}`);
    }

    async notifyDocumentFailed(
        documentId: string,
        userId: string,
        error: string,
    ) {
        const notification = {
            documentId,
            status: 'failed',
            progress: 0,
            message: 'Document processing failed',
            error,
            timestamp: new Date().toISOString(),
        };

        const roomName = `document-${documentId}`;
        this.server.to(roomName).emit('document-failed', notification);

        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('document-failed', notification);
        }

        this.logger.error(`Failure notification sent for document ${documentId}: ${error}`);
    }

    // Método para obtener usuarios conectados (para debugging)
    getConnectedUsers(): string[] {
        return Array.from(this.userSockets.keys());
    }

    // Método para verificar si un usuario está conectado
    isUserConnected(userId: string): boolean {
        return this.userSockets.has(userId);
    }
}