import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ClerkGuard } from "./guard/clerk.guard";
import { ClerkService } from "./clerk.service";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

@Module({
    imports: [ConfigModule],
    providers: [ClerkService, ClerkGuard, AuthService],
    exports: [ClerkService, ClerkGuard],
    controllers: [AuthController]
})
export class AuthModule { }
