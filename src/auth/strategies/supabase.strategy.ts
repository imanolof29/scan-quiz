import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from 'passport-custom';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
    private readonly logger = new Logger(SupabaseStrategy.name);
    private supabase;

    constructor(private readonly configService: ConfigService) {
        super();

        this.supabase = createClient(
            configService.getOrThrow<string>('SUPABASE_URL'),
            configService.getOrThrow<string>('SUPABASE_ANON_KEY')
        );
    }

    async validate(req: any): Promise<any> {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            this.logger.error('No token provided');
            return null;
        }

        try {
            const { data: { user }, error } = await this.supabase.auth.getUser(token);

            if (error || !user) {
                this.logger.error('Invalid token:', error);
                return null;
            }
            return user;
        } catch (error) {
            this.logger.error('Authentication error:', error);
            return null;
        }
    }
}