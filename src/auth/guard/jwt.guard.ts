import { ExecutionContext, Logger } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

export class JwtGuard extends AuthGuard('supabase') {

    private readonly logger = new Logger(JwtGuard.name);

    canActivate(context: ExecutionContext) {
        this.logger.log('JwtGuard activated');
        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, info: any) {
        if (err || !user) {
            this.logger.error('JWT Guard failed:', { err, info });
            throw err || new Error('Unauthorized');
        }
        this.logger.log('JWT Guard success:', { userId: user.id });
        return user;
    }

}