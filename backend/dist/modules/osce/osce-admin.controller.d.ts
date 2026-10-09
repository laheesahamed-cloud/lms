import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { OsceService, CaseDocument } from './osce.service';
import { OsceGeneratorService } from './osce-generator.service';
import { SmartNotesImageApiService } from '../smart-notes/smart-notes-image-api.service';
export declare class OsceAdminController {
    private readonly svc;
    private readonly generator;
    private readonly imageApi;
    private readonly authService;
    constructor(svc: OsceService, generator: OsceGeneratorService, imageApi: SmartNotesImageApiService, authService: AuthService);
    private baseUrl;
    systems(auth?: string): Promise<{
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
        courses: {
            id: number;
            title: string;
            subjectCount: number;
        }[];
    }>;
    createCategory(body: {
        courseId: number;
        name: string;
    }, auth?: string): Promise<{
        id: number;
        courseId: number;
        name: string;
    }>;
    updateCategory(id: number, body: {
        name?: string;
        isActive?: boolean;
    }, auth?: string): Promise<{
        updated: boolean;
    }>;
    deleteCategory(id: number, auth?: string): Promise<{
        deleted: boolean;
    }>;
    reorderCategories(body: {
        ids: number[];
    }, auth?: string): Promise<{
        ordered: number;
    }>;
    reorderCases(body: {
        ids: number[];
    }, auth?: string): Promise<{
        ordered: number;
    }>;
    cases(system?: string, auth?: string): Promise<{
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
    caseById(id: number, auth?: string): Promise<{
        case: {
            caseData: CaseDocument;
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
        };
        shotList: {
            fileName: string;
            filled: boolean;
            media: {
                slot: string;
                storageKey: string;
                externalUrl: string | null;
                thumbKey: string | null;
                mime: string;
                source: string;
                bytes: number;
                width: number | null;
                height: number | null;
                updatedAt: any;
            } | null;
            ratio: string;
            width: number;
            height: number;
            slot: string;
            label: string;
            brief: string;
        }[];
    }>;
    createCase(body: {
        categoryId: number;
        title: string;
        summary?: string;
        difficulty?: string;
        stationType?: 'short' | 'long';
    }, auth?: string): Promise<{
        caseData: CaseDocument;
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
    } | null>;
    generateCase(body: {
        categoryId: number;
        title: string;
        notes?: string;
        stationType?: 'short' | 'long';
    }, auth?: string): Promise<{
        case: {
            caseData: CaseDocument;
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
        } | null;
        warnings: string[];
    }>;
    updateCase(id: number, body: {
        title?: string;
        summary?: string;
        difficulty?: string;
        categoryId?: number;
        caseData?: CaseDocument;
        isPublic?: boolean;
        isFree?: boolean;
        stationType?: 'short' | 'long';
    }, auth?: string): Promise<{
        caseData: CaseDocument;
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
    } | null>;
    deleteCase(id: number, auth?: string): Promise<{
        deleted: boolean;
    }>;
    preview(id: number, req: Request, auth?: string): Promise<{
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
    } | null>;
    shotList(id: number, auth?: string): Promise<{
        shotList: {
            fileName: string;
            filled: boolean;
            media: {
                slot: string;
                storageKey: string;
                externalUrl: string | null;
                thumbKey: string | null;
                mime: string;
                source: string;
                bytes: number;
                width: number | null;
                height: number | null;
                updatedAt: any;
            } | null;
            ratio: string;
            width: number;
            height: number;
            slot: string;
            label: string;
            brief: string;
        }[];
    }>;
    publish(id: number, auth?: string): Promise<{
        caseData: CaseDocument;
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
    } | null>;
    unpublish(id: number, auth?: string): Promise<{
        caseData: CaseDocument;
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
    } | null>;
    uploadSlot(id: number, slot: string, file: any, body: {
        width?: string;
        height?: string;
        thumb?: string;
        source?: string;
    }, auth?: string): Promise<{
        slot: string;
        storageKey: string;
        thumbKey: string | null;
        bytes: number;
    }>;
    linkSlot(id: number, slot: string, body: {
        url?: string;
    }, auth?: string): Promise<{
        slot: string;
        externalUrl: string;
    }>;
    generateSlot(id: number, slot: string, body: {
        prompt?: string;
    }, auth?: string): Promise<{
        dataUrl: string;
        prompt: string;
    }>;
    slotPrompt(id: number, slot: string, auth?: string): Promise<{
        prompt: string;
    }>;
    clearSlot(id: number, slot: string, auth?: string): Promise<{
        cleared: boolean;
    }>;
    getSettings(auth?: string): Promise<{
        imageModel: string;
    }>;
    imageModels(auth?: string): Promise<{
        models: {
            name: string;
            label: string;
            description?: string;
        }[];
        selected: string;
    }>;
    putSettings(body: {
        imageModel?: string;
    }, auth?: string): Promise<{
        model: string;
    }>;
    linkable(req: Request, q?: string, auth?: string): Promise<{
        ecgCards: {
            id: number;
            title: string;
            group: string;
            image: string | null;
        }[];
        auscultationCards: {
            id: number;
            title: string;
            group: string;
            category: string;
            hasAudio: boolean;
            audio: string | null;
        }[];
    }>;
    globalMedia(req: Request, auth?: string): Promise<{
        cast: Record<string, {
            full: string;
            thumb: string;
        } | null>;
    }>;
    uploadGlobal(slot: string, file: any, auth?: string): Promise<{
        slot: string;
        storageKey: string;
    }>;
    generateGlobal(slot: string, auth?: string): Promise<{
        dataUrl: string;
    }>;
    inbox(auth?: string): Promise<{
        files: {
            fileName: string;
            slot: string | null;
        }[];
    }>;
    inboxFile(fileName: string, auth?: string): Promise<{
        fileName: string;
        dataUrl: string;
    }>;
    archiveInboxFile(fileName: string, auth?: string): Promise<{
        archived: boolean;
    }>;
}
