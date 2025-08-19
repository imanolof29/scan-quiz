import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { REQUEST } from "@nestjs/core";
import { SupabaseClient } from "@supabase/supabase-js";
import { ExtractJwt } from 'passport-jwt';

@Injectable()
export class Supabase {
    private readonly logger = new Logger(Supabase.name);
    private clientInstance: SupabaseClient

    constructor(
        @Inject(REQUEST) private readonly request: Request,
        private readonly configService: ConfigService
    ) { }

    getClient() {
        this.logger.log('Creating Supabase client instance');
        if (this.clientInstance) {
            this.logger.log('Returning existing Supabase client instance');
            return this.clientInstance;
        }
        this.logger.log('Creating new Supabase client instance');
        this.clientInstance = new SupabaseClient(
            this.configService.getOrThrow<string>('SUPABASE_URL'),
            this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
        )
        this.clientInstance.auth.setSession(
            ExtractJwt.fromAuthHeaderAsBearerToken()(this.request),
        );
        return this.clientInstance;
    }

}