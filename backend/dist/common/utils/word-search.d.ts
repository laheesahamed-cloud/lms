export declare function searchWords(query: string): string[];
export declare function wordSearchFilter(columns: string[], words: string[]): {
    sql: string;
    params: string[];
} | null;
