declare class ExplanationOptionDto {
    optionLabel: string;
    optionText: string;
    isCorrect?: number | boolean;
}
export declare class GenerateExplanationDto {
    questionText: string;
    questionType?: 'sba' | 'true_false';
    correctAnswerLabel: string;
    options: ExplanationOptionDto[];
    course?: string;
    subject?: string;
    topic?: string;
    lesson?: string;
}
export {};
