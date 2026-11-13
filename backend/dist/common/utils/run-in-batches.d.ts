export declare function runInBatches<T extends readonly (() => Promise<unknown>)[]>(tasks: [...T], limit: number): Promise<{
    -readonly [K in keyof T]: T[K] extends () => Promise<infer R> ? R : never;
}>;
