export type ExamClaims = {
    u: number;
    q: number;
    n: string;
    s: number;
    d: number;
    ids: number[];
};
export declare function newExamNonce(): string;
export declare function signExamToken(claims: ExamClaims): string;
export declare function verifyExamToken(token: unknown, userId: number, quizId: number): ExamClaims | null;
