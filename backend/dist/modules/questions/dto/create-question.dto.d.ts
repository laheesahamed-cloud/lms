export declare class QuestionOptionDto {
    optionLabel: string;
    optionText: string;
    isCorrect: 0 | 1;
    whyIncorrect?: string | null;
    why_incorrect?: string | null;
}
export declare class CreateQuestionDto {
    courseId: number;
    subjectId: number;
    topicId?: number | null;
    lessonId?: number | null;
    paperId?: number | null;
    topicLabel?: string;
    category: 'past' | 'past_paper' | 'mock' | 'ai';
    questionType: 'sba' | 'true_false';
    questionText: string;
    keywordsText?: string;
    explanation?: string;
    status: 'active' | 'inactive';
    options: QuestionOptionDto[];
}
