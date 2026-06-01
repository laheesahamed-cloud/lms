import { Pool } from 'mysql2/promise';
import { CreateSmartNoteDto } from './dto/create-smart-note.dto';
import { UpdateSmartNoteDto } from './dto/update-smart-note.dto';
import { SmartNotesImageApiService } from './smart-notes-image-api.service';
export type CanvasElement = {
    id: string;
    type: string;
    text: string;
    color: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotate: number;
};
export declare class SmartNotesService {
    private readonly db;
    private readonly imageApi;
    constructor(db: Pool, imageApi: SmartNotesImageApiService);
    private getUser;
    list(token: string): Promise<{
        id: number;
        title: string;
        rawText: string | null;
        processedQa: never[];
        infographicElements: unknown[];
        representativeImageData: string | null;
        representativeImagePrompt: string | null;
        createdAt: string;
        updatedAt: string;
    }[]>;
    findOne(id: number, token: string): Promise<{
        id: number;
        title: string;
        rawText: string | null;
        processedQa: never[];
        infographicElements: unknown[];
        representativeImageData: string | null;
        representativeImagePrompt: string | null;
        createdAt: string;
        updatedAt: string;
    }>;
    create(dto: CreateSmartNoteDto, token: string): Promise<{
        id: number;
        title: string;
    }>;
    update(id: number, dto: UpdateSmartNoteDto, token: string): Promise<{
        id: number;
    }>;
    remove(id: number, token: string): Promise<{
        deleted: boolean;
    }>;
    processWithAi(id: number, token: string): Promise<{
        title: string;
        elements: CanvasElement[];
        representativeImageData: string | null;
        representativeImagePrompt: string;
    }>;
    private stackElements;
    private normalizeType;
    private computeHeight;
    private fallbackElements;
    private fallbackSvg;
    private deserialize;
}
