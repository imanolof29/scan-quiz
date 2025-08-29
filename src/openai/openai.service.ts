import { Injectable } from "@nestjs/common";
import OpenAI from "openai";

interface ChatContext {
    relevantChunks: string[];
    documentTitle: string;
    question: string;
    conversationHistory?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
}

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

    async generateChatResponseStream(context: ChatContext): Promise<AsyncIterable<any>> {
        const systemPrompt = this.buildSystemPrompt(context.documentTitle);
        const contextPrompt = this.buildContextPrompt(context.relevantChunks);

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contextPrompt }
        ];

        if (context.conversationHistory && context.conversationHistory.length > 0) {
            const recentHistory = context.conversationHistory.slice(-10);

            for (const message of recentHistory) {
                messages.push({
                    role: message.role,
                    content: message.content
                });
            }
        }

        messages.push({
            role: 'user',
            content: context.question
        });

        return await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            temperature: 0.3,
            max_tokens: 1500,
            stream: true,
        });
    }


    private buildSystemPrompt(documentTitle: string): string {
        return `Eres un asistente inteligente especializado en responder preguntas sobre documentos PDF.

CONTEXTO:
- Estás analizando el documento: "${documentTitle}"
- Tienes acceso a fragmentos relevantes del documento para responder preguntas
- Debes ser preciso, útil y basar tus respuestas en la información proporcionada

INSTRUCCIONES:
1. Responde ÚNICAMENTE basándote en la información del documento proporcionada
2. Si no encuentras información suficiente en el contexto, indícalo claramente
3. Proporciona respuestas claras y bien estructuradas
4. Cuando sea apropiado, menciona en qué página o sección se encuentra la información
5. Si la pregunta requiere información que no está en el documento, explícalo
6. Mantén un tono profesional y útil
7. Puedes hacer referencias cruzadas entre diferentes partes del documento si es relevante

FORMATO DE RESPUESTA:
- Respuesta directa a la pregunta
- Citas o referencias cuando sea apropiado
- Indicación de páginas cuando sea relevante`;
    }

    private buildContextPrompt(relevantChunks: string[]): string {
        if (relevantChunks.length === 0) {
            return "No se encontraron fragmentos relevantes."
        }
        let contextPrompt = "INFORMACION RELEVANTE DEL DOCUMENT: \n\n";
        relevantChunks.forEach((chunk, index) => {
            contextPrompt += `Fragmento ${index + 1}: ${chunk}\n\n`;
        });
        return contextPrompt;
    }

    async generateConversationTitle(firstMessage: string): Promise<string> {
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Genera un título corto (máximo 6 palabras) y descriptivo para una conversación que comienza con esta pregunta. Responde solo con el título, sin comillas ni formato adicional.',
                },
                {
                    role: 'user',
                    content: firstMessage,
                },
            ],
            temperature: 0.3,
            max_tokens: 20
        });
        return response.choices[0].message.content?.trim() || 'Nueva conversación';
    }

}
