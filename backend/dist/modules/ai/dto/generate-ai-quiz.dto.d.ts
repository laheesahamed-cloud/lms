export declare class GenerateAiQuizDto {
    courseId?: number | null;
    subjectId?: number | null;
    topicId?: number | null;
    lessonId?: number | null;
    course?: string;
    subject?: string;
    topic?: string;
    lesson?: string;
    category: 'past_paper' | 'mock' | 'ai';
    questionType: 'sba' | 'true_false';
    difficulty: 'easy' | 'medium' | 'hard';
    numberOfQuestions: number;
    instruction?: string;
    includeExplanations?: boolean;
    includeWhyIncorrect?: boolean;
}
