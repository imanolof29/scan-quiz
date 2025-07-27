import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtGuard } from "./guard/jwt.guard";
import { SupabaseStrategy } from "./strategies/supabase.strategy";

@Module({
    imports: [
        PassportModule,
        ConfigModule,
        JwtModule.registerAsync({
            useFactory: (configService: ConfigService) => {
                return {
                    global: true,
                    secret: configService.get<string>('JWT_SECRET'),
                    signOptions: { expiresIn: 40000 },
                }
            },
            inject: [ConfigService],
        })
    ],
    providers: [JwtGuard, SupabaseStrategy],
    exports: [JwtGuard, JwtModule]
})
export class AuthModule { }