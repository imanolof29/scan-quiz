import { Injectable } from "@nestjs/common";
import { ClerkService } from "./clerk.service";

@Injectable()
export class AuthService {
    constructor(private readonly clerkService: ClerkService) { }

    async deleteAccount(userId: string): Promise<void> {
        try {
            await this.clerkService.deleteUser(userId);
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    }
}
