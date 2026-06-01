export declare class CreateQuizDto {
    courseId: number;
    topicId?: number | null;
    subtopic?: string;
    subtopicId?: number | null;
    lessonId?: number | null;
    paperId?: number | null;
    category?: string;
    collectionTags?: string;
    isFree?: 0 | 1;
    isGeneral: 0 | 1;
    examModeOnly: 0 | 1;
    adminName: string;
    studentTitle: string;
    displayTitleMode?: 'number' | 'title';
    quizTitle?: string;
    quizDescription?: string;
    blueprint?: Record<string, unknown> | null;
    timeLimit: number;
    hideTimeLimit: 0 | 1;
    passingMarks: number;
    hidePassingMarks: 0 | 1;
    status: 'active' | 'inactive';
    questionIds: number[];
}
