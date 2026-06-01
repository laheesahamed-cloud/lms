export type PaginationInput = {
    limit?: number;
    page?: number;
    offset?: number;
};
export type PaginationOptions = {
    defaultLimit?: number;
    maxLimit?: number;
};
export declare function normalizePagination(input?: PaginationInput, options?: PaginationOptions): {
    limit: number;
    offset: number;
};
