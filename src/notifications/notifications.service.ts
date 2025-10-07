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
        await this.notificationTokenRepository.create({
            token: dto.token,
            platform: dto.platform,
            userId
        })
    }

    async sendNotificationToUser(userId: string, title: string, body: string) {
        const tokens = await this.notificationTokenRepository.find({ where: { userId } });
        const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
        const messages: ExpoPushMessage[] = validTokens.map((token) => ({
            to: token,
            sound: 'default',
            title,
            body,
        }));
        const chunks = this.expo.chunkPushNotifications(messages);
        const tickets: ExpoPushTicket[] = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.log("ERROR SENDING NOTIFICATION: ", error);
            }
        }
    }

    async deleteUserTokens(userId: string) {
        await this.notificationTokenRepository.delete({ userId });
    }

}