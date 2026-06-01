type ApiMetricGroup = 'authentication' | 'dashboard' | 'questionFetch' | 'answerSave' | 'reviewData' | 'staticAsset' | 'other';
type ClientMetricRecord = {
    metric: string;
    route: string;
    value: number;
    target?: number;
    timestamp: string;
};
export declare const API_RESPONSE_TARGETS_MS: Record<ApiMetricGroup, number>;
export declare function classifyApiPerformanceRoute(path: string, method: string): ApiMetricGroup;
export declare function recordApiRequestMetric(input: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
}): void;
export declare function recordClientPerformanceMetric(input: unknown): void;
export declare function getPerformanceMetricsSnapshot(): {
    targets: Record<ApiMetricGroup, number>;
    api: Record<string, unknown>;
    client: {
        sampleCount: number;
        latest: ClientMetricRecord[];
    };
};
export {};
