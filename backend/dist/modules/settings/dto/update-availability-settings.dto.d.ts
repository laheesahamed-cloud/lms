export declare class UpdateAvailabilitySettingsDto {
    mode?: 'live' | 'maintenance' | 'coming-soon';
    unlockCode?: string;
}
export declare class VerifyAvailabilityUnlockDto {
    code: string;
}
