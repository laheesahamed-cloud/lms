import { Pool } from 'mysql2/promise';
export type HotspotAction = {
    type: 'sign';
    id: string;
} | {
    type: 'scene';
    id: string;
} | {
    type: 'label';
};
export interface Hotspot {
    x: number;
    y: number;
    label: string;
    action: HotspotAction;
}
export interface Scene {
    id: string;
    title?: string;
    parent?: string | null;
    media?: string | null;
    flip?: {
        label: string;
        media: string;
    } | null;
    compare?: {
        label: string;
        media: string;
    } | null;
    hotspots?: Hotspot[];
}
export interface Sign {
    id: string;
    name: string;
    category: 'inspection' | 'palpation' | 'percussion' | 'auscultation' | 'symptom';
    region?: string | null;
    media?: string | null;
    compare?: {
        label: string;
        media: string;
    } | null;
    short?: string;
    body?: string;
    brief?: string;
}
export interface ContentRef {
    type: 'ecg_card' | 'auscultation_card';
    id: number;
}
export interface CaseDocument {
    version: number;
    scenes: Scene[];
    signs: Sign[];
    chain: Array<{
        step: number;
        title: string;
        media?: string | null;
        body?: string;
    }>;
    investigations: Array<{
        modality: 'ecg' | 'cxr' | 'echo' | 'labs' | 'other';
        ref?: ContentRef | null;
        media?: string | null;
        findings?: string[];
    }>;
    sounds: Array<{
        title: string;
        ref?: ContentRef | null;
        compareWith?: ContentRef | null;
        markers?: Array<{
            label: string;
            from: number;
            to: number;
        }>;
    }>;
    summary: {
        keyPoints?: string[];
        osceTips?: string[];
        connect?: Array<{
            from: string;
            to: number;
        }>;
    };
    related?: Array<{
        rel: 'cause' | 'complication' | 'differential';
        case: string;
        note?: string;
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
}
export declare const BODY_SPEC: {
    ratio: string;
    width: number;
    height: number;
};
export declare const STANDARD_SPEC: {
    ratio: string;
    width: number;
    height: number;
};
export declare const SLOT_SPECS: Record<string, {
    ratio: string;
    width: number;
    height: number;
}>;
export declare function specForSlot(slotKey: string): {
    ratio: string;
    width: number;
    height: number;
};
export declare const GLOBAL_CASE_ID = 0;
export declare const GLOBAL_SLOTS: string[];
export declare function slotToFileBase(slotKey: string): string;
export declare class OsceService {
    private readonly db;
    constructor(db: Pool);
    listSystems(publishedOnly?: boolean, userId?: number): Promise<{
        id: number;
        key: string;
        name: string;
        courseId: number;
        courseTitle: string;
        iconKey: null;
        sortOrder: number;
        isActive: boolean;
        caseCount: number;
        locked: boolean;
    }[]>;
    listRegions(baseUrl: string, userId?: number): Promise<{
        key: "head" | "neck" | "chest" | "abdomen" | "groin" | "hands" | "legs" | "general";
        label: string;
        caseCount: number;
        cases: Record<string, unknown>[];
    }[]>;
    listLinkableContent(query: string, baseUrl?: string): Promise<{
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
    globalMedia(baseUrl: string): Promise<Record<string, {
        full: string;
        thumb: string;
    } | null>>;
    saveGlobalImage(slotKey: string, file: {
        buffer: Buffer;
        mimetype: string;
    }): Promise<{
        slot: string;
        storageKey: string;
    }>;
    listCategories(opts?: {
        courseId?: number;
        publishedOnly?: boolean;
        userId?: number;
    }): Promise<{
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
    }[]>;
    createCategory(courseId: number, name: string): Promise<{
        id: number;
        courseId: number;
        name: string;
    }>;
    updateCategory(id: number, patch: {
        name?: string;
        isActive?: boolean;
    }): Promise<{
        updated: boolean;
    }>;
    deleteCategory(id: number): Promise<{
        deleted: boolean;
    }>;
    reorderCategories(ids: number[]): Promise<{
        ordered: number;
    }>;
    reorderCases(ids: number[]): Promise<{
        ordered: number;
    }>;
    getImageModel(): Promise<string>;
    setImageModel(model: string): Promise<{
        model: string;
    }>;
    canGenerateSlot(slotKey: string): boolean;
    categoryName(categoryId: number): Promise<string>;
    listStudentCourses(userId: number): Promise<{
        id: number;
        title: string;
        caseCount: number;
        subjectCount: number;
        locked: boolean;
    }[]>;
    listCourses(): Promise<{
        id: number;
        title: string;
        subjectCount: number;
    }[]>;
    listCases(opts?: {
        categoryId?: number;
        publishedOnly?: boolean;
        userId?: number;
        baseUrl?: string;
    }): Promise<{
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
    }[]>;
    private mapCaseRow;
    private accessProfile;
    private parseIdList;
    private courseInScope;
    private caseInScope;
    createCase(input: {
        categoryId: number;
        title: string;
        summary?: string;
        difficulty?: string;
        caseData?: CaseDocument;
        stationType?: 'short' | 'long';
        createdBy?: number | null;
    }): Promise<{
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
    private uniqueSlug;
    getCaseById(id: number): Promise<{
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
    getCaseBySlug(slug: string, publishedOnly?: boolean): Promise<{
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
    private parseDoc;
    updateCase(id: number, patch: {
        title?: string;
        summary?: string;
        difficulty?: string;
        categoryId?: number;
        caseData?: CaseDocument;
        isPublic?: boolean;
        isFree?: boolean;
        stationType?: 'short' | 'long';
    }): Promise<{
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
    deleteCase(id: number): Promise<{
        deleted: boolean;
    }>;
    declaredSlots(doc: CaseDocument): Array<{
        slot: string;
        label: string;
        brief: string;
    }>;
    listMedia(caseId: number): Promise<{
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
    }[]>;
    shotList(caseId: number): Promise<{
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
    }[]>;
    saveSlotImage(caseId: number, slotKey: string, file: {
        buffer: Buffer;
        mimetype: string;
        originalname?: string;
    }, meta?: {
        width?: number;
        height?: number;
        thumbBuffer?: Buffer;
        source?: 'upload' | 'ai';
    }): Promise<{
        slot: string;
        storageKey: string;
        thumbKey: string | null;
        bytes: number;
    }>;
    saveSlotLink(caseId: number, slotKey: string, rawUrl: string): Promise<{
        slot: string;
        externalUrl: string;
    }>;
    promptForSlot(caseId: number, slotKey: string): Promise<string>;
    saveGeneratedSlot(caseId: number, slotKey: string, dataUrl: string): Promise<{
        slot: string;
        storageKey: string;
        thumbKey: string | null;
        bytes: number;
    }>;
    clearSlot(caseId: number, slotKey: string): Promise<{
        cleared: boolean;
    }>;
    listInbox(): Promise<{
        fileName: string;
        slot: string | null;
    }[]>;
    private slotFromFileName;
    takeFromInbox(fileName: string): Promise<{
        buffer: NonSharedBuffer;
        path: string;
    }>;
    discardInbox(fileName: string): Promise<{
        discarded: boolean;
    }>;
    archiveInbox(fileName: string): Promise<void>;
    private extForMime;
    static isVideoMime(mime?: string | null): boolean;
    publishCase(id: number): Promise<{
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
    unpublishCase(id: number): Promise<{
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
    getProgress(userId: number): Promise<{
        caseId: number;
        slug: string;
        checklist: {};
        favourite: boolean;
        seen: never[];
        completedAt: any;
        updatedAt: any;
    }[]>;
    saveProgress(userId: number, caseId: number, body: {
        checklist?: Record<string, boolean>;
        seen?: string[];
        completed?: boolean;
        favourite?: boolean;
    }): Promise<{
        saved: boolean;
    }>;
    private safeJson;
    hydrateCase(slug: string, baseUrl: string, publishedOnly?: boolean, userId?: number): Promise<{
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
                hotspots?: Hotspot[];
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
                ref?: ContentRef | null;
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
                ref?: ContentRef | null;
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
                ref?: ContentRef | null;
                compareWith?: ContentRef | null;
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
    private resolveRelated;
    private ecgCardSummary;
    private auscultationAudio;
    auscultationAudioBytes(cardId: number): Promise<{
        buffer: NonSharedBuffer;
        mime: string;
    } | null>;
    ecgImageBytes(cardId: number): Promise<{
        mime: string;
        buffer: Buffer<ArrayBuffer>;
    } | null>;
}
