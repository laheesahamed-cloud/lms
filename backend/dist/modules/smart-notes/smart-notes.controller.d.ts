import { SmartNotesService } from './smart-notes.service';
import { CreateSmartNoteDto } from './dto/create-smart-note.dto';
import { UpdateSmartNoteDto } from './dto/update-smart-note.dto';
export declare class SmartNotesController {
    private readonly smartNotesService;
    constructor(smartNotesService: SmartNotesService);
    list(auth: string): Promise<{
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
    findOne(id: number, auth: string): Promise<{
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
    create(dto: CreateSmartNoteDto, auth: string): Promise<{
        id: number;
        title: string;
    }>;
    update(id: number, dto: UpdateSmartNoteDto, auth: string): Promise<{
        id: number;
    }>;
    processWithAi(id: number, auth: string): Promise<{
        title: string;
        elements: import("./smart-notes.service").CanvasElement[];
        representativeImageData: string | null;
        representativeImagePrompt: string;
    }>;
    remove(id: number, auth: string): Promise<{
        deleted: boolean;
    }>;
}
