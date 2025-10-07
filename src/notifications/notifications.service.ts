import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { NotificationTokenEntity } from "./entity/notification-token";
import { Repository } from 'typeorm';
import { RegisterTokenDto } from "./dto/register-token.dto";
import Expo, { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";

@Injectable()
export class NotificationsService {

    private expo = new Expo();

    constructor(
        @InjectRepository(NotificationTokenEntity)
        private readonly notificationTokenRepository: Repository<NotificationTokenEntity>
    ) { }

    async registerToken(dto: RegisterTokenDto, userId: string) {
        const newToken = await this.notificationTokenRepository.create({
            token: dto.token,
            platform: dto.platform,
            userId
        });
        await this.notificationTokenRepository.save(newToken);
    }

    async sendNotificationToUser(userId: string, title: string, body: string) {
        const tokens = await this.notificationTokenRepository.find({ where: { userId } });

        if (tokens.length === 0) {
            console.log("No tokens found for user:", userId);
            return;
        }

        const validTokens = tokens
            .map(t => t.token)
            .filter((token) => Expo.isExpoPushToken(token));

        if (validTokens.length === 0) {
            console.log("No valid Expo tokens found");
            return;
        }

        const messages: ExpoPushMessage[] = validTokens.map((token) => ({
            to: token,
            sound: 'default',
            title,
            body,
            data: { userId }
        }));

        const chunks = this.expo.chunkPushNotifications(messages);
        const tickets: ExpoPushTicket[] = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
                console.log("Tickets received:", ticketChunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error("ERROR SENDING NOTIFICATION: ", error);
            }
        }

        for (const ticket of tickets) {
            if (ticket.status === 'error') {
                console.error("Error in ticket:", ticket.message);
                if (ticket.details?.error) {
                    console.error("Error details:", ticket.details.error);
                }
            }
        }

        return tickets;
    }

    async deleteUserTokens(userId: string) {
        await this.notificationTokenRepository.delete({ userId });
    }

}