export declare const GRACE_SPACING_DAYS = 7;
export declare function streakAssignments(today: string): {
    sql: string;
    params: string[];
};
export declare function streakAssignmentsWhen(today: string, condSql: string, condParams: unknown[]): {
    sql: string;
    params: unknown[];
};
export declare function streakShown(row: {
    streak?: unknown;
    last_active_day?: unknown;
    streak_forgiven_day?: unknown;
    streak_after_forgiven?: unknown;
} | undefined, today: string): {
    streak: number;
    graceActive: boolean;
};
export declare function streakStateFromDays(dayKeys: string[]): {
    streak: number;
    lastActive: string | null;
    forgiven: string | null;
    afterForgiven: number;
};
