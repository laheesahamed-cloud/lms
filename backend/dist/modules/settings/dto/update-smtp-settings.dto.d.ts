export declare class UpdateSmtpSettingsDto {
    enabled?: boolean;
    host?: string;
    port?: number;
    security?: 'starttls' | 'ssl';
    username?: string;
    password?: string;
    fromName?: string;
    fromEmail?: string;
    publicUrl?: string;
    subject?: string;
    heading?: string;
    intro?: string;
    buttonLabel?: string;
    footer?: string;
}
