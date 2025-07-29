import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QuestionEntity } from "./entity/question";
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

            // Guardar preguntas en BD
            for (const questionData of questions) {
                const question = this.questionsRepository.create({
                    ...questionData,
                    document: { id: documentId },
                });
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
Basándote en el siguiente contenido, genera 3-4 preguntas de opción múltiple de calidad para estudiar:

CONTENIDO:
${content}

INSTRUCCIONES:
- Genera preguntas que evalúen comprensión, no memorización
- Incluye 4 opciones (A, B, C, D) por pregunta
- Una sola respuesta correcta por pregunta
- Incluye explicación breve de por qué es correcta
- Varía la dificultad (fácil, medio, difícil)
- Enfócate en conceptos clave y relaciones importantes

FORMATO DE RESPUESTA (JSON):
{
  "questions": [
    {
      "question": "¿Cuál es el concepto principal...?",
      "options": ["A) Opción 1", "B) Opción 2", "C) Opción 3", "D) Opción 4"],
      "correctAnswer": "B",
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

        // Parsear respuesta JSON
        const parsedResponse = JSON.parse(response ?? "");

        // Agregar metadatos
        return parsedResponse.questions.map(q => ({
            ...q,
            sourceChunkIds: chunks.map(c => c.id),
            pageReferences: this.generatePageReferences(chunks),
        }));
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