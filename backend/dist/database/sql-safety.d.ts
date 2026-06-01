export declare function sqlIdentifier(value: string, allowedValues?: Iterable<string>, label?: string): string;
export declare function allowedSqlFragment(value: string, allowedValues: Iterable<string>, label?: string): string;
export declare function sqlPlaceholders(values: readonly unknown[]): string;
