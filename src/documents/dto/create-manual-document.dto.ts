export class CreateManualDocumentDto {
    title: string;
    questions: QuestionDto[];
}

export class QuestionDto {
    question: string;
    options: string[];
    correctOptionIndex: number;
}