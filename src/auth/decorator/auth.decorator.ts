import { applyDecorators, UseGuards } from "@nestjs/common";
import { ClerkGuard } from "../guard/clerk.guard";

export function Auth() {
    return applyDecorators(UseGuards(ClerkGuard));
}