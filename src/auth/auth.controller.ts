import { Controller, Delete } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorator/user.decorator";

@Controller('auth')
export class AuthController {

    constructor(private readonly authService: AuthService) { }

    @Delete('delete-account')
    async deleteAccount(@CurrentUser('id') userId: string): Promise<void> {
        await this.authService.deleteAccount(userId);
    }

}