import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, verifyToken } from '@clerk/backend';

@Injectable()
export class ClerkService {
    private readonly clerkClient: ReturnType<typeof createClerkClient>;
    private readonly secretKey: string;

    constructor(private readonly configService: ConfigService) {
        this.secretKey = this.configService.getOrThrow<string>('CLERK_SECRET_KEY');
        this.clerkClient = createClerkClient({ secretKey: this.secretKey });
    }

    async verifyToken(token: string) {
        return verifyToken(token, { secretKey: this.secretKey });
    }

    async deleteUser(userId: string): Promise<void> {
        await this.clerkClient.users.deleteUser(userId);
    }
}
