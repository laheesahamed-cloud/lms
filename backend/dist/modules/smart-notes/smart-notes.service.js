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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartNotesService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const auth_token_util_1 = require("../auth/auth-token.util");
const smart_notes_image_api_service_1 = require("./smart-notes-image-api.service");
const COLORS = ['#FFF9C4', '#E8F5E9', '#E3F2FD', '#FCE4EC', '#F3E5F5', '#FFF3E0'];
let SmartNotesService = class SmartNotesService {
    constructor(db, imageApi) {
        this.db = db;
        this.imageApi = imageApi;
    }
    async getUser(token) {
        if (!token)
            throw new common_1.UnauthorizedException('Missing auth token');
        const [rows] = await this.db.execute(`SELECT id, role, status
       FROM users
       WHERE session_token = ?
         AND session_expires_at > NOW()
       LIMIT 1`, [(0, auth_token_util_1.hashSessionToken)(token)]);
        if (!rows.length)
            throw new common_1.UnauthorizedException('Invalid or expired session');
        const u = rows[0];
        if (u.role !== 'student' || u.status !== 'active')
            throw new common_1.ForbiddenException('Active student account required');
        return u;
    }
    async list(token) {
        const user = await this.getUser(token);
        const [rows] = await this.db.execute(`SELECT id, user_id, title, NULL AS raw_text, NULL AS processed_qa, NULL AS infographic_elements,
              NULL AS representative_image_data, representative_image_prompt, created_at, updated_at
       FROM smart_notes WHERE user_id = ? ORDER BY updated_at DESC`, [user.id]);
        return rows.map((r) => this.deserialize(r));
    }
    async findOne(id, token) {
        const user = await this.getUser(token);
        const [rows] = await this.db.execute(`SELECT id, user_id, title, raw_text, processed_qa, infographic_elements,
              representative_image_data, representative_image_prompt, created_at, updated_at
       FROM smart_notes
       WHERE id = ? AND user_id = ?
       LIMIT 1`, [id, user.id]);
        if (!rows.length)
            throw new common_1.NotFoundException('Note not found');
        return this.deserialize(rows[0]);
    }
    async create(dto, token) {
        const user = await this.getUser(token);
        const [result] = await this.db.execute('INSERT INTO smart_notes (user_id, title, raw_text) VALUES (?, ?, ?)', [user.id, dto.title, dto.rawText ?? null]);
        return { id: result.insertId, title: dto.title };
    }
    async update(id, dto, token) {
        const user = await this.getUser(token);
        const [existing] = await this.db.execute('SELECT id FROM smart_notes WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing.length)
            throw new common_1.NotFoundException('Note not found');
        const fields = [];
        const values = [];
        if (dto.title !== undefined) {
            fields.push('title = ?');
            values.push(dto.title);
        }
        if (dto.rawText !== undefined) {
            fields.push('raw_text = ?');
            values.push(dto.rawText);
        }
        if (dto.processedQa !== undefined) {
            fields.push('processed_qa = ?');
            values.push(JSON.stringify(dto.processedQa));
        }
        if (dto.infographicElements !== undefined) {
            fields.push('infographic_elements = ?');
            values.push(JSON.stringify(dto.infographicElements));
        }
        if (dto.representativeImageData !== undefined) {
            fields.push('representative_image_data = ?');
            values.push(dto.representativeImageData);
        }
        if (dto.representativeImagePrompt !== undefined) {
            fields.push('representative_image_prompt = ?');
            values.push(dto.representativeImagePrompt);
        }
        if (!fields.length)
            return { id };
        values.push(id, user.id);
        await this.db.execute(`UPDATE smart_notes SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
        return { id };
    }
    async remove(id, token) {
        const user = await this.getUser(token);
        await this.db.execute('DELETE FROM smart_notes WHERE id = ? AND user_id = ?', [id, user.id]);
        return { deleted: true };
    }
    async processWithAi(id, token) {
        const note = await this.findOne(id, token);
        const user = await this.getUser(token);
        if (!note.rawText || note.rawText.trim().length < 20) {
            throw new Error('Notes must be at least 20 characters');
        }
        const layout = await this.imageApi.generateLayout(note.rawText);
        const title = (layout?.title || note.title || 'Study Note').trim();
        const imagePrompt = (layout?.imagePrompt || title).trim();
        const rawElements = layout?.elements?.length ? layout.elements : this.fallbackElements(note.rawText, title);
        const elements = this.stackElements(rawElements, title);
        const imageData = await this.imageApi.generateIllustration(imagePrompt) || this.fallbackSvg(imagePrompt);
        const IMAGE_CAP = 700_000;
        const imageForDb = imageData && imageData.length <= IMAGE_CAP ? imageData : null;
        await this.db.execute(`UPDATE smart_notes SET title = ?, infographic_elements = ?, representative_image_data = ?, representative_image_prompt = ? WHERE id = ? AND user_id = ?`, [title, JSON.stringify(elements), imageForDb, imagePrompt, id, user.id]);
        const imageForResponse = imageData && imageData.length <= IMAGE_CAP ? imageData : null;
        return { title, elements, representativeImageData: imageForResponse, representativeImagePrompt: imagePrompt };
    }
    stackElements(raw, title) {
        const CANVAS_W = 600;
        const LEFT_X = 12;
        const LEFT_W = 272;
        const TITLE_H = 72;
        const GAP = 10;
        const result = [];
        result.push({
            id: 'title',
            type: 'title',
            text: title.toUpperCase(),
            color: '#E3F2FD',
            x: 12,
            y: 12,
            w: CANVAS_W - 24,
            h: TITLE_H,
            rotate: 0,
        });
        let currentY = TITLE_H + 12 + 16;
        for (const el of raw.slice(0, 8)) {
            const type = this.normalizeType(el.type);
            const color = COLORS.includes(el.color) ? el.color : COLORS[result.length % COLORS.length];
            const text = String(el.text || '').trim().slice(0, 600);
            if (!text)
                continue;
            const h = this.computeHeight(type, text);
            result.push({
                id: el.id || `el_${result.length}`,
                type,
                text,
                color,
                x: LEFT_X,
                y: currentY,
                w: LEFT_W,
                h,
                rotate: type === 'callout' ? parseFloat((Math.random() * 2 - 1).toFixed(1)) : 0,
            });
            currentY += h + GAP;
        }
        return result;
    }
    normalizeType(t) {
        const s = String(t || '').toLowerCase().trim();
        if (s === 'section' || s === 'heading')
            return 'section';
        if (s === 'bullet-list' || s === 'bullet_list' || s === 'bullets')
            return 'bullet-list';
        if (s === 'box' || s === 'mnemonic' || s === 'comparison_box' || s === 'note_box')
            return 'box';
        if (s === 'callout' || s === 'tip' || s === 'note')
            return 'callout';
        return 'bullet-list';
    }
    computeHeight(type, text) {
        if (type === 'section')
            return 44;
        if (type === 'callout')
            return 72;
        const lines = text.split('\n').filter((l) => l.trim()).length;
        const lineH = 22;
        const padding = type === 'box' ? 36 : 26;
        return Math.min(Math.max(lines * lineH + padding, 60), 220);
    }
    fallbackElements(rawText, title) {
        const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
        const bullets = lines.slice(0, 6).map((l) => `• ${l.replace(/^[•\-*]\s*/, '')}`).join('\n');
        return [
            { id: 'e1', type: 'section', text: title, color: '#FFF9C4' },
            { id: 'e2', type: 'bullet-list', text: bullets, color: '#E8F5E9' },
        ];
    }
    fallbackSvg(seedText) {
        const t = seedText.toLowerCase();
        const isHeart = /heart|cardiac|cardio|failure|pump/.test(t);
        const isLung = /lung|pulmonary|breath|dyspnea|copd|pneumonia/.test(t);
        const isBrain = /brain|neuro|stroke|seizure|dementia/.test(t);
        const isKidney = /kidney|renal|nephro|dialysis/.test(t);
        let art = '';
        let label = 'MEDICAL DIAGRAM';
        if (isHeart) {
            label = 'HEART';
            art = `
        <path d="M140 230 C140 230 70 185 70 130 C70 100 90 82 115 82 C128 82 138 90 140 98 C142 90 152 82 165 82 C190 82 210 100 210 130 C210 185 140 230 140 230Z" fill="#EF9A9A" stroke="#C62828" stroke-width="2"/>
        <path d="M100 138 L118 138 L128 118 L140 158 L150 130 L162 138 L182 138" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="215" y1="105" x2="240" y2="90" stroke="#9E9E9E" stroke-width="1"/>
        <text x="242" y="89" font-size="9" fill="#555" font-family="sans-serif">AV node</text>
        <line x1="215" y1="155" x2="240" y2="155" stroke="#9E9E9E" stroke-width="1"/>
        <text x="242" y="158" font-size="9" fill="#555" font-family="sans-serif">Ventricle</text>
        <line x1="140" y1="230" x2="140" y2="255" stroke="#9E9E9E" stroke-width="1"/>
        <text x="108" y="265" font-size="9" fill="#555" font-family="sans-serif">Left ventricle</text>`;
        }
        else if (isLung) {
            label = 'LUNGS';
            art = `
        <path d="M110 90 C90 90 75 108 75 130 L75 200 C75 218 88 232 105 234 C116 220 122 196 122 172 L122 90 Z" fill="#F48FB1" stroke="#880E4F" stroke-width="1.5"/>
        <path d="M170 90 C190 90 205 108 205 130 L205 200 C205 218 192 232 175 234 C164 220 158 196 158 172 L158 90 Z" fill="#F48FB1" stroke="#880E4F" stroke-width="1.5"/>
        <rect x="134" y="72" width="12" height="140" rx="5" fill="#90A4AE"/>
        <path d="M140 92 C122 80 108 86 100 98" stroke="#78909C" stroke-width="2" stroke-linecap="round" fill="none"/>
        <path d="M140 92 C158 80 172 86 180 98" stroke="#78909C" stroke-width="2" stroke-linecap="round" fill="none"/>
        <line x1="75" y1="130" x2="50" y2="120" stroke="#9E9E9E" stroke-width="1"/>
        <text x="10" y="119" font-size="9" fill="#555" font-family="sans-serif">Pleura</text>
        <line x1="140" y1="72" x2="140" y2="52" stroke="#9E9E9E" stroke-width="1"/>
        <text x="108" y="48" font-size="9" fill="#555" font-family="sans-serif">Trachea</text>
        <line x1="205" y1="165" x2="230" y2="165" stroke="#9E9E9E" stroke-width="1"/>
        <text x="232" y="168" font-size="9" fill="#555" font-family="sans-serif">Alveoli</text>`;
        }
        else if (isBrain) {
            label = 'BRAIN';
            art = `
        <ellipse cx="140" cy="150" rx="70" ry="60" fill="#FFCCBC" stroke="#BF360C" stroke-width="1.5"/>
        <path d="M100 120 C105 110 115 108 120 115 C122 105 130 102 135 108" stroke="#E64A19" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M145 108 C150 102 158 105 160 115 C165 108 175 110 180 120" stroke="#E64A19" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M85 145 C88 138 95 135 100 140" stroke="#E64A19" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M180 145 C177 138 170 135 165 140" stroke="#E64A19" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M100 165 C115 158 125 162 140 165 C155 168 165 158 180 165" stroke="#E64A19" stroke-width="1.5" fill="none"/>
        <line x1="210" y1="125" x2="235" y2="108" stroke="#9E9E9E" stroke-width="1"/>
        <text x="237" y="107" font-size="9" fill="#555" font-family="sans-serif">Frontal lobe</text>
        <line x1="210" y1="165" x2="235" y2="165" stroke="#9E9E9E" stroke-width="1"/>
        <text x="237" y="168" font-size="9" fill="#555" font-family="sans-serif">Temporal lobe</text>
        <line x1="140" y1="210" x2="140" y2="235" stroke="#9E9E9E" stroke-width="1"/>
        <text x="110" y="245" font-size="9" fill="#555" font-family="sans-serif">Cerebellum</text>`;
        }
        else if (isKidney) {
            label = 'KIDNEY';
            art = `
        <path d="M110 100 C85 100 70 120 70 150 C70 180 85 200 110 200 C125 200 132 188 140 175 C148 188 155 200 170 200 C195 200 210 180 210 150 C210 120 195 100 170 100 C155 100 148 112 140 125 C132 112 125 100 110 100Z" fill="#CE93D8" stroke="#6A1B9A" stroke-width="1.5"/>
        <ellipse cx="140" cy="150" rx="18" ry="25" fill="#E1BEE7" stroke="#7B1FA2" stroke-width="1.5"/>
        <line x1="70" y1="140" x2="45" y2="128" stroke="#9E9E9E" stroke-width="1"/>
        <text x="5" y="127" font-size="9" fill="#555" font-family="sans-serif">Cortex</text>
        <line x1="140" y1="175" x2="140" y2="200" stroke="#9E9E9E" stroke-width="1"/>
        <text x="108" y="212" font-size="9" fill="#555" font-family="sans-serif">Renal pelvis</text>
        <line x1="210" y1="155" x2="235" y2="155" stroke="#9E9E9E" stroke-width="1"/>
        <text x="237" y="158" font-size="9" fill="#555" font-family="sans-serif">Medulla</text>`;
        }
        else {
            label = 'ANATOMY';
            art = `
        <circle cx="140" cy="140" r="60" fill="#B3E5FC" stroke="#0277BD" stroke-width="2"/>
        <circle cx="140" cy="140" r="35" fill="#E1F5FE" stroke="#0288D1" stroke-width="1.5"/>
        <line x1="140" y1="95" x2="140" y2="185" stroke="#01579B" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="95" y1="140" x2="185" y2="140" stroke="#01579B" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="200" y1="108" x2="225" y2="95" stroke="#9E9E9E" stroke-width="1"/>
        <text x="227" y="94" font-size="9" fill="#555" font-family="sans-serif">Nucleus</text>
        <line x1="200" y1="172" x2="225" y2="172" stroke="#9E9E9E" stroke-width="1"/>
        <text x="227" y="175" font-size="9" fill="#555" font-family="sans-serif">Cytoplasm</text>`;
        }
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 320" width="280" height="320">
  <rect width="280" height="320" fill="white"/>
  <text x="140" y="24" text-anchor="middle" font-size="12" font-weight="bold" fill="#1a237e" font-family="sans-serif">${label}</text>
  ${art}
</svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }
    deserialize(row) {
        let elements = [];
        try {
            elements = row.infographic_elements ? JSON.parse(row.infographic_elements) : [];
        }
        catch {
            elements = [];
        }
        return {
            id: row.id,
            title: row.title,
            rawText: row.raw_text,
            processedQa: [],
            infographicElements: elements,
            representativeImageData: row.representative_image_data,
            representativeImagePrompt: row.representative_image_prompt,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
};
exports.SmartNotesService = SmartNotesService;
exports.SmartNotesService = SmartNotesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, smart_notes_image_api_service_1.SmartNotesImageApiService])
], SmartNotesService);
//# sourceMappingURL=smart-notes.service.js.map