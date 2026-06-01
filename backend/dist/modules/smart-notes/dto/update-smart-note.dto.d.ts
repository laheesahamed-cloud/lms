export declare class UpdateSmartNoteDto {
    title?: string;
    rawText?: string;
    processedQa?: Array<{
        q: string;
        a: string;
    }>;
    infographicElements?: Array<Record<string, unknown>>;
    representativeImageData?: string;
    representativeImagePrompt?: string;
}
