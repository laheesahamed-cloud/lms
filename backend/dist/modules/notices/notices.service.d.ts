export declare const FEED_LIMIT = 30;
export type Audience = 'all' | 'student' | 'admin';
export type Notice = {
    id: number;
    kind: 'content' | 'admin';
    title: string;
    body: string;
    url: string;
    audience: Audience;
    createdAt: string;
};
export type Popup = {
    id: number;
    style: 'card' | 'banner';
    title: string;
    body: string;
    imageUrl: string;
    actionLabel: string;
    actionPath: string;
    startAt: string | null;
    endAt: string | null;
    priority: number;
    audience: Audience;
    status: 'active' | 'draft';
    createdAt: string;
    updatedAt: string;
};
export declare class NoticesService {
    private readonly logger;
    private readonly dir;
    private readonly feed;
    private readonly popups;
    addNotice(input: {
        kind: Notice['kind'];
        title: string;
        body: string;
        url?: string;
        audience?: Audience;
    }): Notice;
    noticesFor(role: string, afterId?: number): {
        items: Notice[];
        latestId: number;
    };
    popupsFor(role: string, now?: Date): Popup[];
    listPopups(): Popup[];
    createPopup(input: any): Popup;
    updatePopup(id: number, input: any): Popup;
    deletePopup(id: number): void;
}
