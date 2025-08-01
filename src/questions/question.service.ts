import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QuestionEntity } from "./entity/question.entity";
import { Repository } from 'typeorm';
import { OpenAIService } from "src/openai/openai.service";
import { ChunkService } from "src/chunks/chunk.service";

@Injectable()
export class QuestionsService {

    constructor(
        @InjectRepository(QuestionEntity)
        private readonly questionsRepository: Repository<QuestionEntity>,
        private readonly openaiService: OpenAIService,
        private readonly chunksService: ChunkService
    ) { }

    async generateQuestionsForDocument(documentId: string) {
        try {
            // Obtener todos los chunks del documento
            const chunks = await this.chunksService.findChunksByDocumentId(documentId);

            if (chunks.length === 0) {
                throw new Error('No chunks found for document');
            }

            const questions: any[] = [];

            // Generar preguntas para cada chunk (o grupos de chunks relacionados)
            for (let i = 0; i < chunks.length; i += 2) { // Procesar de 2 en 2
                const chunkGroup = chunks.slice(i, i + 2);
                const combinedContent = chunkGroup.map(c => c.content).join('\n\n');

                try {
                    const generatedQuestions = await this.generateQuestionsFromContent(
                        combinedContent,
                        chunkGroup,
                    );

                    questions.push(...generatedQuestions);
                } catch (error) {
                    console.error(`Error generating questions for chunk group ${i}:`, error);
                }
            }

            for (const questionData of questions) {
                const normalizedQuestionData = {
                    ...questionData,
                    pageReferences: Array.isArray(questionData.pageReferences)
                        ? questionData.pageReferences
                        : [questionData.pageReferences],
                    document: { id: documentId },
                };

                const question = this.questionsRepository.create(normalizedQuestionData);
                await this.questionsRepository.save(question);
            }

            return questions;
        } catch (error) {
            console.error('Error generating questions for document:', error);
            throw error;
        }
    }

    private async generateQuestionsFromContent(content: string, chunks: any[]) {
        const prompt = `
Basándote en el siguiente contenido, genera 3-4 preguntas de opción múltiple de calidad para estudiar.

CONTENIDO:
${content}

INSTRUCCIONES:
- Genera preguntas que evalúen comprensión, no memorización
- Incluye 4 opciones (A, B, C, D) por pregunta
- Una sola respuesta correcta por pregunta
- Incluye explicación breve de por qué es correcta
- Varía la dificultad (fácil, medio, difícil)
- Enfócate en conceptos clave y relaciones importantes

IMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin formato markdown.

FORMATO DE RESPUESTA (JSON exacto):
{
  "questions": [
    {
      "question": "¿Cuál es el concepto principal...?",
      "options": ["A) Opción 1", "B) Opción 2", "C) Opción 3", "D) Opción 4"],
      "answerIndex": 1,
      "explanation": "La respuesta B es correcta porque...",
      "difficulty": "medium",
      "questionType": "multiple_choice"
    }
  ]
}
`;

        const response = await this.openaiService.generateQuestions(content, {
            prompt,
            maxTokens: 2000,
            temperature: 0.7,
        });

        // Limpiar y parsear respuesta JSON
        let parsedResponse;
        try {
            // Verificar que la respuesta no sea null o undefined
            if (!response) {
                throw new Error('Respuesta vacía o nula de OpenAI');
            }

            // Limpiar posibles caracteres de markdown o texto adicional
            const cleanedResponse = this.cleanJsonResponse(response);
            parsedResponse = JSON.parse(cleanedResponse);

            // Validar estructura de respuesta
            if (!parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
                throw new Error('Respuesta no tiene el formato esperado: debe contener un array de questions');
            }
        } catch (parseError) {
            console.error('Error parsing OpenAI response:', parseError);
            console.error('Raw response:', response);
            throw new Error(`Error parseando respuesta de OpenAI: ${parseError.message}`);
        }

        // Agregar metadatos
        return parsedResponse.questions.map(q => ({
            ...q,
            sourceChunkIds: chunks.map(c => c.id),
            pageReferences: this.generatePageReferences(chunks),
        }));
    }

    private cleanJsonResponse(response: string): string {
        if (!response) {
            throw new Error('Respuesta vacía de OpenAI');
        }

        // Eliminar posibles bloques de código markdown
        let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // Eliminar líneas que comiencen con # (markdown headers)
        cleaned = cleaned.replace(/^#+.*$/gm, '');

        // Eliminar líneas vacías al principio y final
        cleaned = cleaned.trim();

        // Buscar el primer { y el último } para extraer solo el JSON
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('No se encontró JSON válido en la respuesta');
        }

        return cleaned.substring(firstBrace, lastBrace + 1);
    }

    private generatePageReferences(chunks: any[]): string {
        const pageNumbers = [...new Set(chunks.map(c => c.pageNumber))].sort((a, b) => a - b);

        if (pageNumbers.length === 1) {
            return `Page ${pageNumbers[0]}`;
        } else if (pageNumbers.length === 2) {
            return `Pages ${pageNumbers[0]}-${pageNumbers[1]}`;
        } else {
            return `Pages ${pageNumbers[0]}-${pageNumbers[pageNumbers.length - 1]}`;
        }
    }

}