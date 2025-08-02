export class QuestionDto {
    id: string;
    question: string
    options: string[];
    correctAnswer: number;
    difficulty: string;
    questionType: string;
    pageReferences: string[];
}