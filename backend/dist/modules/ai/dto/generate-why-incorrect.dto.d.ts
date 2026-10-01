declare class WhyIncorrectOptionDto {
    optionLabel: string;
    optionText: string;
    isCorrect?: number | boolean;
    whyIncorrect?: string | null;
}
export declare class GenerateWhyIncorrectDto {
    questionType?: 'sba' | 'true_false';
    questionText: string;
    correctAnswerLabel?: string;
    explanation?: string;
    options: WhyIncorrectOptionDto[];
    course?: string;
    subject?: string;
    topic?: string;
    lesson?: string;
}
export {};
