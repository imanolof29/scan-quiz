import { QuestionDto } from "./question.dto";

export class DocumentQuestionDto {
    documentId: string;
    title: string
    questions: QuestionDto[];
    totalQuestions: number;
    estimatedTime: number;
}