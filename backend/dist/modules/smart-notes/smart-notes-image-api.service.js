"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartNotesImageApiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fetch_with_retry_1 = require("../../common/utils/fetch-with-retry");
let SmartNotesImageApiService = class SmartNotesImageApiService {
    constructor(configService) {
        this.configService = configService;
    }
    async generateLayout(notes) {
        const key = this.apiKey();
        if (!key || !notes.trim())
            return null;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 25000);
        try {
            const res = await (0, fetch_with_retry_1.fetchWithRetry)(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: ctrl.signal,
                body: JSON.stringify({
                    generationConfig: { responseMimeType: 'application/json' },
                    contents: [{ parts: [{ text: this.layoutPrompt(notes) }] }],
                }),
            });
            if (!res.ok) {
                const err = await res.text().catch(() => '');
                console.error('[SmartNotes] Layout API error', res.status, err.slice(0, 200));
                return null;
            }
            const json = await res.json();
            const raw = json?.candidates?.[0]?.content?.parts?.find((p) => typeof p?.text === 'string')?.text?.trim();
            if (!raw)
                return null;
            const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
            return {
                title: String(parsed?.title || '').trim(),
                imagePrompt: String(parsed?.imagePrompt || '').trim(),
                elements: Array.isArray(parsed?.elements) ? parsed.elements : [],
            };
        }
        catch (err) {
            console.error('[SmartNotes] Layout error:', err instanceof Error ? err.message : String(err));
            return null;
        }
        finally {
            clearTimeout(t);
        }
    }
    async generateIllustration(topic) {
        const key = this.apiKey();
        if (!key || !topic.trim())
            return null;
        const nativeImg = await this.tryNativeImage(topic, key);
        if (nativeImg)
            return nativeImg;
        const svgImg = await this.tryGeminiSvg(topic, key);
        if (svgImg)
            return svgImg;
        return null;
    }
    async tryNativeImage(topic, key) {
        const models = ['gemini-2.0-flash-preview-image-generation', 'gemini-2.0-flash-exp', 'gemini-2.5-flash'];
        for (const model of models) {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 35000);
            try {
                const res = await (0, fetch_with_retry_1.fetchWithRetry)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: ctrl.signal,
                    body: JSON.stringify({
                        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
                        contents: [{ parts: [{ text: `Create a clean medical educational illustration about: ${topic}. Style: white background, labeled anatomical diagram, textbook quality, soft clinical colors, no borders.` }] }],
                    }),
                });
                if (!res.ok) {
                    console.error(`[SmartNotes] ${model} HTTP ${res.status}`);
                    continue;
                }
                const json = await res.json();
                const part = json?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data);
                if (part?.inlineData?.data) {
                    return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
                console.error(`[SmartNotes] ${model} returned no image part`);
            }
            catch (err) {
                console.error(`[SmartNotes] ${model} error:`, err instanceof Error ? err.message : String(err));
            }
            finally {
                clearTimeout(t);
            }
        }
        return null;
    }
    async tryGeminiSvg(topic, key) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 20000);
        try {
            const res = await (0, fetch_with_retry_1.fetchWithRetry)(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: ctrl.signal,
                body: JSON.stringify({
                    contents: [{ parts: [{ text: this.svgPrompt(topic) }] }],
                }),
            });
            if (!res.ok)
                return null;
            const json = await res.json();
            const text = json?.candidates?.[0]?.content?.parts?.find((p) => typeof p?.text === 'string')?.text?.trim() || '';
            const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
            if (!svgMatch)
                return null;
            return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMatch[0])}`;
        }
        catch {
            return null;
        }
        finally {
            clearTimeout(t);
        }
    }
    apiKey() {
        return String(this.configService.get('SMART_NOTES_IMAGE_API_KEY') ||
            this.configService.get('GEMINI_API_KEY') || '').trim();
    }
    layoutPrompt(notes) {
        return `Convert these medical notes into study layout elements. Return valid JSON only — no markdown.

Notes:
${notes.slice(0, 4000)}

Return exactly this JSON structure:
{
  "title": "SHORT TITLE ALL CAPS (3-5 words)",
  "imagePrompt": "medical diagram to illustrate this topic, e.g. 'heart failure anatomy showing congested ventricles and pulmonary edema with labels'",
  "elements": [
    { "id": "e1", "type": "section",     "text": "Definition",                                              "color": "#FFF9C4" },
    { "id": "e2", "type": "bullet-list", "text": "• Cannot pump enough blood\\n• HFrEF vs HFpEF\\n• EF ≤40%", "color": "#E8F5E9" },
    { "id": "e3", "type": "section",     "text": "Key Causes",                                             "color": "#FFF9C4" },
    { "id": "e4", "type": "bullet-list", "text": "• IHD most common\\n• Hypertension\\n• Valvular disease",  "color": "#E3F2FD" },
    { "id": "e5", "type": "box",         "text": "MNEMONIC: FACES\\nFatigue\\nActivities limited\\nCongestion\\nEdema\\nShortness of breath", "color": "#FFF3E0" },
    { "id": "e6", "type": "callout",     "text": "Echo: check EF!",                                        "color": "#FCE4EC" }
  ]
}

Rules:
- Types allowed: "section" (bold heading), "bullet-list" (bullets with \\n), "box" (framed block, first line = header), "callout" (small tip ≤15 words)
- Colors: #FFF9C4=yellow, #E8F5E9=green, #E3F2FD=blue, #FCE4EC=pink, #F3E5F5=purple, #FFF3E0=orange
- bullet-list: use "• text\\n• text" format
- Generate 4-7 elements (no title element — handled separately)
- Return ONLY the JSON object`;
    }
    svgPrompt(topic) {
        return `Draw a clean medical educational SVG diagram of: ${topic}

Requirements:
- xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 320" width="280" height="320"
- White background rectangle
- Main anatomical structure with soft clinical colors (pinks, reds, blues)
- 3-5 label lines with text pointing to key parts (font-size="10")
- Small centered title at top (font-size="12" font-weight="bold" fill="#1a237e")
- Clean medical textbook style

Return ONLY the SVG XML, starting with <svg`;
    }
};
exports.SmartNotesImageApiService = SmartNotesImageApiService;
exports.SmartNotesImageApiService = SmartNotesImageApiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SmartNotesImageApiService);
//# sourceMappingURL=smart-notes-image-api.service.js.map