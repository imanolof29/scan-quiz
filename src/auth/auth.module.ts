import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { JwtGuard } from "./guard/jwt.guard";
import { SupabaseStrategy } from "./strategies/supabase.strategy";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { CommonModule } from "src/common/common.module";

@Module({
    imports: [
        PassportModule,
        ConfigModule,
        CommonModule
    ],
    providers: [JwtGuard, SupabaseStrategy, AuthService],
    exports: [JwtGuard, SupabaseStrategy],
    controllers: [AuthController]
})
export class AuthModule { }