import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { JwtGuard } from "./guard/jwt.guard";
import { SupabaseStrategy } from "./strategies/supabase.strategy";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

@Module({
    imports: [
        PassportModule,
        ConfigModule,
    ],
    providers: [JwtGuard, SupabaseStrategy, AuthService],
    exports: [JwtGuard, SupabaseStrategy],
    controllers: [AuthController]
})
export class AuthModule { }