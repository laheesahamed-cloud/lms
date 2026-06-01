export declare class CreateLessonDto {
    courseId: number;
    topicId: number;
    subtopicId: number;
    lessonTitle: string;
    lessonContent?: string;
    videoUrl?: string;
    isFree?: 0 | 1;
    status: 'active' | 'inactive';
}
