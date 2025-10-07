import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationTokenEntity } from "./entity/notification-token";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
    providers: [NotificationsService],
    exports: [NotificationsService],
    controllers: [NotificationsController],
    imports: [TypeOrmModule.forFeature([NotificationTokenEntity]),]
})
export class NotificationsModule { }