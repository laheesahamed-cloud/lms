import { Pool, PoolConnection } from 'mysql2/promise';
export declare function forgetContentHistory(_db: Pool | PoolConnection, _entityType: string, _ids: number[]): Promise<void>;
