import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { OsceService } from './osce.service';
export declare class OsceController {
    private readonly svc;
    private readonly authService;
    constructor(svc: OsceService, authService: AuthService);
    private baseUrl;
    courses(auth?: string): Promise<{
        courses: {
            id: number;
            title: string;
            caseCount: number;
            subjectCount: number;
            locked: boolean;
        }[];
    }>;
    regions(req: Request, auth?: string): Promise<{
        regions: {
            key: "general" | "head" | "neck" | "chest" | "abdomen" | "groin" | "hands" | "legs";
            label: string;
            caseCount: number;
            cases: Record<string, unknown>[];
        }[];
    }>;
    systems(courseId?: string, auth?: string): Promise<{
        systems: {
            id: number;
            key: string;
            name: string;
            courseId: number;
            courseTitle: string;
            sortOrder: number;
            isActive: boolean;
            iconKey: null;
            caseCount: number;
            locked: boolean;
        }[];
    }>;
    cases(req: Request, system?: string, auth?: string): Promise<{
        cases: {
            favourite: boolean;
            completed: boolean;
            locked: boolean;
            cover: {
                full: string;
                thumb: string;
            } | null;
            id: number;
            title: string;
            slug: string;
            summary: string;
            difficulty: string;
            status: string;
            isPublic: boolean;
            isFree: boolean;
            courseId: number;
            categoryId: number;
            stationType: string;
            sortOrder: number;
            systemKey: string | null;
            systemName: string | null;
            courseTitle: string | null;
            updatedAt: any;
        }[];
    }>;
    caseBySlug(slug: string, req: Request, auth?: string): Promise<{
        caseData: {
            cast?: Record<string, {
                full: string;
                thumb: string;
            } | null> | undefined;
            scenes: {
                image: {
                    full: string;
                    thumb: string | null;
                    width: number | null;
                    height: number | null;
                    kind: string;
                    mime: string | null;
                } | null;
                flip: {
                    label: string;
                    image: {
                        full: string;
                        thumb: string | null;
                        width: number | null;
                        height: number | null;
                        kind: string;
                        mime: string | null;
                    } | null;
                } | null;
                compare: {
                    label: string;
                    image: {
                        full: string;
                        thumb: string | null;
                        width: number | null;
                        height: number | null;
                        kind: string;
                        mime: string | null;
                    } | null;
                } | null;
                id: string;
                title?: string;
                parent?: string | null;
                media?: string | null;
                hotspots?: import("./osce.service").Hotspot[];
            }[];
            signs: {
                image: {
                    full: string;
                    thumb: string | null;
                    width: number | null;
                    height: number | null;
                    kind: string;
                    mime: string | null;
                } | null;
                compare: {
                    label: string;
                    image: {
                        full: string;
                        thumb: string | null;
                        width: number | null;
                        height: number | null;
                        kind: string;
                        mime: string | null;
                    } | null;
                } | null;
                id: string;
                name: string;
                category: "inspection" | "palpation" | "percussion" | "auscultation" | "symptom";
                region?: string | null;
                media?: string | null;
                short?: string;
                body?: string;
                brief?: string;
            }[];
            chain: {
                image: {
                    full: string;
                    thumb: string | null;
                    width: number | null;
                    height: number | null;
                    kind: string;
                    mime: string | null;
                } | null;
                step: number;
                title: string;
                media?: string | null;
                body?: string;
            }[];
            investigations: ({
                title: string;
                image: {
                    full: string;
                    thumb: null;
                    width: null;
                    height: null;
                } | null;
                modality: "ecg" | "cxr" | "echo" | "labs" | "other";
                ref?: import("./osce.service").ContentRef | null;
                media?: string | null;
                findings?: string[];
            } | {
                image: {
                    full: string;
                    thumb: string | null;
                    width: number | null;
                    height: number | null;
                    kind: string;
                    mime: string | null;
                } | null;
                modality: "ecg" | "cxr" | "echo" | "labs" | "other";
                ref?: import("./osce.service").ContentRef | null;
                media?: string | null;
                findings?: string[];
            })[];
            sounds: {
                audio: {
                    title: string;
                    url: string;
                } | null;
                compareAudio: {
                    title: string;
                    url: string;
                } | null;
                title: string;
                ref?: import("./osce.service").ContentRef | null;
                compareWith?: import("./osce.service").ContentRef | null;
                markers?: Array<{
                    label: string;
                    from: number;
                    to: number;
                }>;
            }[];
            related: Record<string, unknown>[];
            summary: {
                connect: {
                    from: string;
                    to: number;
                }[];
                graph: {
                    step: number;
                    title: string;
                    body: string;
                    signs: {
                        id: any;
                        name: any;
                        short: any;
                        category: any;
                    }[];
                }[];
                keyPoints?: string[];
                osceTips?: string[];
            };
            version: number;
            treatment?: Array<{
                group: string;
                items: string[];
            }>;
            practice: {
                checklist: Array<{
                    section: string;
                    items: string[];
                }>;
                questions: Array<{
                    q: string;
                    a: string;
                }>;
            };
        };
        cover: {
            full: string;
            thumb: string | null;
            width: number | null;
            height: number | null;
            kind: string;
            mime: string | null;
        } | null;
        id: number;
        title: string;
        slug: string;
        summary: string;
        difficulty: string;
        status: string;
        isPublic: boolean;
        isFree: boolean;
        courseId: number;
        categoryId: number;
        stationType: string;
        sortOrder: number;
        systemKey: string | null;
        systemName: string | null;
        courseTitle: string | null;
        updatedAt: any;
    }>;
    progress(auth?: string): Promise<{
        progress: {
            caseId: number;
            slug: string;
            checklist: {};
            favourite: boolean;
            seen: never[];
            completedAt: any;
            updatedAt: any;
        }[];
    }>;
    saveProgress(caseId: number, body: {
        checklist?: Record<string, boolean>;
        seen?: string[];
        completed?: boolean;
        favourite?: boolean;
    }, auth?: string): Promise<{
        saved: boolean;
    }>;
    ecgImage(cardId: number, res: Response): Promise<void>;
    soundAudio(cardId: number, req: Request, res: Response): Promise<void>;
    private sendRangeable;
    media(caseSlug: string, fileName: string, res: Response): Promise<void>;
}
