export declare function xpAmountSql(base: number, day: string): {
    sql: string;
    params: Array<number | string>;
};
export declare function xpAmountFor(baseSql: string, baseParams: unknown[], day: string): {
    sql: string;
    params: any[];
};
export declare function xpPayAssignments(base: number, day: string, capture?: boolean): {
    sql: string;
    params: any[];
};
export declare function xpPayAssignmentsFor(baseSql: string, baseParams: unknown[], day: string, capture?: boolean): {
    sql: string;
    params: any[];
};
