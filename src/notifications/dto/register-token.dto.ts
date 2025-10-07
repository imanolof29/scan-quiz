import { Platform } from "../entity/notification-token";

export class RegisterTokenDto {
    token: string;
    platform: Platform;
}