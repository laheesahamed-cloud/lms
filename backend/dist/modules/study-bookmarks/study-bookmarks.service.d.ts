import { Pool } from 'mysql2/promise';
import { ToggleStudyBookmarkDto } from './dto/toggle-study-bookmark.dto';
export declare class StudyBookmarksService {
    private readonly db;
    constructor(db: Pool);
    list(userId: number): Promise<{
        id: number;
        userId: number;
        itemType: "question" | "quiz" | "ai_note";
        itemId: number;
        title: string;
        examModeOnly: boolean;
        engineKey: string | null;
        quizId: number | null;
        courseTitle: string;
        topicName: string;
        createdAt: string | null;
    }[]>;
    toggle(userId: number, dto: ToggleStudyBookmarkDto): Promise<{
        ok: boolean;
        saved: boolean;
    }>;
    private assertTargetExists;
}
