import { AuthService } from '../auth/auth.service';
import { ToggleStudyBookmarkDto } from './dto/toggle-study-bookmark.dto';
import { StudyBookmarksService } from './study-bookmarks.service';
export declare class StudyBookmarksController {
    private readonly studyBookmarksService;
    private readonly authService;
    constructor(studyBookmarksService: StudyBookmarksService, authService: AuthService);
    list(authorization?: string): Promise<{
        id: number;
        userId: number;
        itemType: "quiz" | "ai_note" | "question";
        itemId: number;
        title: string;
        examModeOnly: boolean;
        engineKey: string | null;
        quizId: number | null;
        courseTitle: string;
        topicName: string;
        createdAt: string | null;
    }[]>;
    toggle(authorization: string | undefined, dto: ToggleStudyBookmarkDto): Promise<{
        ok: boolean;
        saved: boolean;
    }>;
}
