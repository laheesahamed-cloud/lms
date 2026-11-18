export declare class UpdateStudentLessonProgressDto {
    status: 'not_started' | 'in_progress' | 'completed';
    progressPercent?: number;
    userId?: number;
    readSeconds?: number;
    subjectId?: number;
}
