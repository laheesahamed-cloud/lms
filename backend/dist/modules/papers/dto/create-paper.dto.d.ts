export declare class CreatePaperDto {
    paperTitle: string;
    year: number;
    examSource: 'local' | 'erpm';
    keywordsText?: string;
    status: 'active' | 'inactive';
}
