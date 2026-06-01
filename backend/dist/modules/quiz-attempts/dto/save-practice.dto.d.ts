export declare class SavePracticeDto {
    questionId: number;
    questionIndex: number;
    questionType: 'sba' | 'true_false';
    selected?: number[];
    tfAnswers?: Record<string, number | string>;
    userId?: number;
}
