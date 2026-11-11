export declare function localDateKey(d: Date): string;
export declare function toDayNumber(key: string): number;
export declare function computeStreak(dayKeys: string[], todayKey: string): {
    streak: number;
    graceActive: boolean;
};
