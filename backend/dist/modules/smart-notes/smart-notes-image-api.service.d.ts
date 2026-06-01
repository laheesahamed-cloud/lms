import { ConfigService } from '@nestjs/config';
type LayoutElement = {
    id: string;
    type: string;
    text: string;
    color: string;
};
type LayoutResult = {
    title: string;
    imagePrompt: string;
    elements: LayoutElement[];
};
export declare class SmartNotesImageApiService {
    private readonly configService;
    constructor(configService: ConfigService);
    generateLayout(notes: string): Promise<LayoutResult | null>;
    generateIllustration(topic: string): Promise<string | null>;
    private tryNativeImage;
    private tryGeminiSvg;
    private apiKey;
    private layoutPrompt;
    private svgPrompt;
}
export {};
