import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Auth } from "src/auth/decorator/auth.decorator";
import { NotificationsService } from "./notifications.service";
import { RegisterTokenDto } from "./dto/register-token.dto";
import { CurrentUser } from "src/auth/decorator/user.decorator";

@Controller('notifications')
@Auth()
@ApiTags('Notifications')
export class NotificationsController {

    constructor(private readonly notificationsService: NotificationsService) { }

    @Post('register')
    async registerToken(@Body() dto: RegisterTokenDto, @CurrentUser('id') userId: string) {
        return await this.notificationsService.registerToken(dto, userId);
    }

}