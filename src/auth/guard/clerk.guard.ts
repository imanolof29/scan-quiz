import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClerkService } from '../clerk.service';

@Injectable()
export class ClerkGuard implements CanActivate {
    constructor(private readonly clerkService: ClerkService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = request.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            throw new UnauthorizedException();
        }

        try {
            const payload = await this.clerkService.verifyToken(token);
            request.user = { id: payload.sub };
            return true;
        } catch {
            throw new UnauthorizedException();
        }
    }
}
