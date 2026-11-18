import { Pool } from 'mysql2/promise';
export declare function getContentVersion(db: Pool): Promise<number>;
export declare function onContentVersionChange(listener: (version: number) => void): void;
export declare function bumpContentVersion(db: Pool): Promise<void>;
export declare function watchContentVersion(db: Pool, intervalMs?: number): void;
export declare function isCatalogueWrite(method: string, path: string): boolean;
