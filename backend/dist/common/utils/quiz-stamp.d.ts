import { Pool, PoolConnection } from 'mysql2/promise';
export declare function bumpQuizStamps(db: Pool | PoolConnection, change: {
    quizIds?: number[];
    questionIds?: number[];
}): Promise<void>;
export declare function bumpAllQuizStamps(db: Pool | PoolConnection): Promise<void>;
export declare function bumpQuizStampsForDeletedQuestions(db: Pool | PoolConnection, questionIds: number[]): Promise<void>;
