import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { JwtGuard } from "./guard/jwt.guard";
import { SupabaseStrategy } from "./strategies/supabase.strategy";

@Module({
    imports: [
        PassportModule,
        ConfigModule,
    ],
    providers: [JwtGuard, SupabaseStrategy],
    exports: [JwtGuard, SupabaseStrategy]
})
export class AuthModule { }