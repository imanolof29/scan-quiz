import { Injectable } from "@nestjs/common";
import OpenAI from "openai";

@Injectable()
export class OpenAIService {
    private openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    async generateEmbedding(text: string): Promise<number[]> {
        const response = await this.openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
        });
        return response.data[0].embedding;
    }

    async generateQuestions(content: string, options: any) {
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Eres un asistente que genera preguntas de quiz en formato JSON estricto. SIEMPRE responde únicamente con JSON válido, sin texto adicional, sin formato markdown, sin explicaciones fuera del JSON.',
                },
                {
                    role: 'user',
                    content: options.prompt,
                },
            ],
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 2000,
            response_format: { type: "json_object" }
        });
        return response.choices[0].message.content;
    }
}
