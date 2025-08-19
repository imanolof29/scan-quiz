import { Injectable } from "@nestjs/common";
import { Supabase } from "src/common/services/supabase";

@Injectable()
export class AuthService {

    constructor(
        private readonly supabase: Supabase
    ) { }

    async deleteAccount(userId: string): Promise<void> {
        try {
            await this.supabase.getClient().auth.admin.deleteUser(userId);
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    }

}