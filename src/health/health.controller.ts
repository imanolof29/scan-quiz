import { Controller, Get, HttpStatus } from "@nestjs/common";

@Controller('health')
export class HealthController {

    @Get('status')
    getStatus() {
        return {
            status: 'ok',
            code: HttpStatus.OK
        };
    }

}