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
var OsceGeneratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OsceGeneratorService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_tokens_1 = require("../../database/database.tokens");
const fetch_with_retry_1 = require("../../common/utils/fetch-with-retry");
const ai_provider_utils_1 = require("../../common/utils/ai-provider.utils");
const REQUEST_TIMEOUT_MS = 120_000;
const GEMINI_MODELS = ['gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash'];
let OsceGeneratorService = OsceGeneratorService_1 = class OsceGeneratorService {
    constructor(db, config) {
        this.db = db;
        this.config = config;
        this.logger = new common_1.Logger(OsceGeneratorService_1.name);
    }
    async generateCase(condition, systemKey, notes, stationType = 'short') {
        const provider = await this.resolveProvider();
        const prompt = stationType === 'long'
            ? this.buildLongCasePrompt(condition, systemKey, notes)
            : this.buildPrompt(condition, systemKey, notes);
        const raw = await this.callProvider(prompt, provider, stationType === 'long' ? 65536 : 16384);
        const parsed = this.parseJson(raw);
        return stationType === 'long'
            ? this.normalizeLongCase(parsed, condition)
            : this.normalize(parsed, condition);
    }
    buildLongCasePrompt(condition, systemKey, notes) {
        return `You are writing a LONG CASE for a final-year medical student
(MBBS / ERPM, Sri Lankan curriculum). The patient has: "${condition}" (${systemKey}).

A long case is history taking. The student asks; the patient answers in their own
words — lay language, not textbook terms. Write the encounter as it would actually
run in the exam.

Return ONLY JSON, no prose, no code fences:

{
  "summary": "One line: who the patient is and what brought them in.",
  "patient": { "name": "First name only", "age": 54, "sex": "male | female",
               "occupation": "short", "opening": "What the patient says first, in their own words." },
  "sections": [
    { "id": "introduction",        "title": "Introduction",              "purpose": "One line on what to achieve here.",
      "exchanges": [ { "ask": "What the student says or asks",
                       "reply": "What the patient answers, in lay language",
                       "note": "Optional: what a good student notices here. Omit if nothing to add." } ] },
    { "id": "presenting-complaint", "title": "Presenting complaint",     "purpose": "...", "exchanges": [ ... ] },
    { "id": "systemic-review",      "title": "Systemic review",          "purpose": "...", "exchanges": [ ... ] },
    { "id": "past-medical",         "title": "Past medical history",     "purpose": "...", "exchanges": [ ... ] },
    { "id": "past-surgical",        "title": "Past surgical history",    "purpose": "...", "exchanges": [ ... ] },
    { "id": "drugs-allergies",      "title": "Drugs and allergies",      "purpose": "...", "exchanges": [ ... ] },
    { "id": "family-social",        "title": "Family and social history", "purpose": "...", "exchanges": [ ... ] }
  ],
  "differentials": [ { "diagnosis": "Most likely first", "supporting": "What in the history points here",
                       "against": "What argues against it" } ],
  "initialManagement": ["Short, ordered first steps"],
  "summaryBlock": { "keyPoints": ["..."], "osceTips": ["..."] },
  "practice": {
    "checklist": [ { "section": "introduction | presenting-complaint | systemic-review | past-medical | past-surgical | drugs-allergies | family-social",
                     "items": ["Ask about ..."] } ],
    "questions": [ { "q": "Viva question an examiner would ask", "a": "Model answer, 2-3 sentences." } ]
  }
}

Rules:
- 5 to 9 exchanges per section. Enough to be realistic, not a transcript.
- The patient answers like a person: "it comes on when I walk up the hill", never
  "exertional dyspnoea". The student's job is to translate.
- The history must actually fit ${condition} — risk factors, timeline and negatives
  a real patient with this condition would give, including relevant NEGATIVES.
- Differentials ordered most likely first, and say what argues against each.
- No images are needed: a long case uses the shared doctor and patient pictures.
${notes ? `\nAdditional instructions from the author: ${notes}` : ''}`;
    }
    normalizeLongCase(parsed, condition) {
        const warnings = [
            'Generated history is a draft — check every answer before publishing.',
        ];
        const slug = (v) => String(v || '').toLowerCase().trim()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const sections = (Array.isArray(parsed?.sections) ? parsed.sections : []).map((sec, i) => ({
            id: slug(sec?.id || sec?.title) || `section-${i + 1}`,
            title: String(sec?.title || `Section ${i + 1}`),
            purpose: String(sec?.purpose || ''),
            exchanges: (Array.isArray(sec?.exchanges) ? sec.exchanges : []).map((ex) => ({
                ask: String(ex?.ask || ''),
                reply: String(ex?.reply || ''),
                note: ex?.note ? String(ex.note) : '',
            })).filter((ex) => ex.ask || ex.reply),
        })).filter((sec) => sec.exchanges.length);
        if (!sections.length)
            warnings.push('No history sections were generated — add them by hand.');
        const patient = parsed?.patient || {};
        const document = {
            version: 1,
            stationType: 'long',
            patient: {
                name: String(patient?.name || 'The patient'),
                age: Number(patient?.age) || null,
                sex: String(patient?.sex || ''),
                occupation: String(patient?.occupation || ''),
                opening: String(patient?.opening || ''),
            },
            sections,
            differentials: (Array.isArray(parsed?.differentials) ? parsed.differentials : []).map((d) => ({
                diagnosis: String(d?.diagnosis || ''),
                supporting: String(d?.supporting || ''),
                against: String(d?.against || ''),
            })),
            initialManagement: (Array.isArray(parsed?.initialManagement) ? parsed.initialManagement : [])
                .map((m) => String(m)),
            scenes: [], signs: [], chain: [], investigations: [], sounds: [],
            summary: {
                keyPoints: (parsed?.summaryBlock?.keyPoints || []).map((k) => String(k)),
                osceTips: (parsed?.summaryBlock?.osceTips || []).map((t) => String(t)),
                connect: [],
            },
            related: [],
            practice: {
                checklist: (Array.isArray(parsed?.practice?.checklist) ? parsed.practice.checklist : [])
                    .map((c) => ({
                    section: String(c?.section || 'history'),
                    items: Array.isArray(c?.items) ? c.items.map((i) => String(i)) : [],
                })),
                questions: (Array.isArray(parsed?.practice?.questions) ? parsed.practice.questions : [])
                    .map((q) => ({ q: String(q?.q || ''), a: String(q?.a || '') })),
            },
        };
        return { summary: String(parsed?.summary || ''), document, warnings };
    }
    async generateImage(prompt, preferredModel) {
        const provider = await this.resolveProvider();
        if (provider.providerKey !== 'gemini' || !provider.apiKey)
            return null;
        const models = Array.from(new Set([
            String(preferredModel || '').trim(),
            'gemini-2.5-flash-image',
            'gemini-2.0-flash-preview-image-generation',
            'gemini-2.0-flash-exp',
        ].filter(Boolean)));
        for (const model of models) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 90_000);
            try {
                const res = await (0, fetch_with_retry_1.fetchWithRetry)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: ctrl.signal,
                    body: JSON.stringify({
                        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
                        contents: [{ parts: [{ text: prompt }] }],
                    }),
                });
                if (!res.ok) {
                    this.logger.warn(`OSCE image model ${model}: HTTP ${res.status}`);
                    continue;
                }
                const json = await res.json();
                const part = json?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data);
                if (part?.inlineData?.data) {
                    const u = json.usageMetadata;
                    this.logger.log(`OSCE image [${model}] tokens in=${u?.promptTokenCount ?? '?'} `
                        + `out=${u?.candidatesTokenCount ?? '?'} total=${u?.totalTokenCount ?? '?'}`);
                    return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
                this.logger.warn(`OSCE image model ${model} returned no image part`);
            }
            catch (error) {
                this.logger.warn(`OSCE image model ${model}: ${error instanceof Error ? error.message : String(error)}`);
            }
            finally {
                clearTimeout(timer);
            }
        }
        return null;
    }
    async listImageModels() {
        const provider = await this.resolveProvider();
        if (provider.providerKey !== 'gemini' || !provider.apiKey)
            return [];
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20_000);
        try {
            const res = await (0, fetch_with_retry_1.fetchWithRetry)(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(provider.apiKey)}`, { method: 'GET', signal: ctrl.signal });
            if (!res.ok) {
                this.logger.warn(`Listing image models failed: HTTP ${res.status}`);
                return [];
            }
            const json = await res.json();
            return (json.models || [])
                .map((m) => ({
                name: String(m.name || '').replace(/^models\//, ''),
                label: String(m.displayName || m.name || ''),
                methods: m.supportedGenerationMethods || [],
                description: String(m.description || ''),
            }))
                .filter((m) => m.name && (m.methods.some((x) => /image/i.test(x) || x === 'predict')
                || /image/i.test(m.name)))
                .map(({ name, label, description }) => ({ name, label, description }));
        }
        catch (error) {
            this.logger.warn(`Listing image models failed: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
        finally {
            clearTimeout(timer);
        }
    }
    buildPrompt(condition, systemKey, notes) {
        return `You are writing an OSCE examination station for final-year medical students
(MBBS / ERPM, Sri Lankan curriculum) on: "${condition}" (system: ${systemKey}).

Return ONLY JSON matching this schema — no prose, no code fences:

{
  "summary": "One sentence a student would recognise the condition by.",
  "signs": [
    {
      "id": "kebab-case-id",
      "name": "Malar flush",
      "category": "inspection | palpation | percussion | auscultation | symptom",
      "region": "face | neck | hands | chest | abdomen | legs | general",
      "short": "One line stating the finding.",
      "body": "2-3 sentences: what it is and WHY it happens in this condition.",
      "brief": "A VISUAL description for whoever sources the photograph. Name the exact colour, the exact anatomical distribution, and the patient context. Describe only what the eye sees — never the mechanism, never the diagnosis. If the sign is not visible (a murmur, a sound), write an empty string."
    }
  ],
  "scenes": [
    { "id": "body", "title": "Full patient", "parent": null,
      "hotspots": [ { "x": 0.5, "y": 0.12, "label": "Malar flush", "signId": "malar-flush" },
                    { "x": 0.5, "y": 0.40, "label": "Chest", "sceneId": "chest" } ] },
    { "id": "chest", "title": "Praecordium", "parent": "body", "hotspots": [] }
  ],
  "chain": [ { "step": 1, "title": "Narrowed valve", "body": "One sentence." } ],
  "investigations": [
    { "modality": "ecg | cxr | echo | labs", "findings": ["Short finding", "Short finding"] }
  ],
  "sounds": [
    { "title": "${condition} at the apex",
      "markers": [ { "label": "S1", "from": 0, "to": 120 } ] }
  ],
  "summaryBlock": {
    "keyPoints": ["..."],
    "osceTips": ["..."],
    "connect": [ { "from": "malar-flush", "to": 2 } ]
  },
  "related": [ { "rel": "cause | complication | differential", "case": "kebab-case-name", "note": "short" } ],
  "practice": {
    "checklist": [ { "section": "history | general | system_exam | investigations | diagnosis",
                     "items": ["Ask about ...", "Look for ..."] } ],
    "questions": [ { "q": "Common viva question", "a": "Model answer, 2-3 sentences." } ]
  }
}

Rules:
- 5 to 9 signs, only findings genuinely present in this condition. Do not pad.
- Scenes must form a zoom chain from "body" down to the organ or structure, each
  scene's "parent" naming the one above it. 3-5 scenes.
- Every hotspot uses x/y as fractions between 0 and 1 of the image, and names either
  a signId (open the finding) or a sceneId (zoom deeper) — never both. Positions are
  approximate; a human corrects them.
- Sound markers are milliseconds within one cardiac/respiratory cycle.
- Be specific and exam-accurate: name intervals, positions, manoeuvres. Prefer the
  wording an examiner would mark ("tapping, undisplaced apex beat").
- If a finding is classically ABSENT and that absence is discriminating, say so in body.
- Image briefs are read by someone who cannot see the patient and may not be
  medically trained. "Bluish-red cheeks" is too vague and will produce the wrong
  picture; "dusky reddish-purple discolouration over both malar eminences, with
  surrounding facial pallor, in a young adult" is right. Precision here matters
  more than elegance.
- Each investigation's "findings" are a list across the whole disease course, so
  they may not all be present on one film or strip at the same time. List them
  anyway; do not try to reconcile them.
- "connect" ties each sign back to the step of the pathophysiology that causes it:
  "from" is a sign id you used above, "to" is a chain step number. This is what
  turns a list of findings into an explanation, so cover every sign that a chain
  step actually accounts for. Omit a sign rather than invent a mechanism for it,
  and never reference an id or step number you did not create.
${notes ? `\nAdditional instructions from the author: ${notes}` : ''}`;
    }
    normalize(parsed, condition) {
        const warnings = [];
        const slug = (v) => String(v || '').toLowerCase().trim()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const signs = (Array.isArray(parsed?.signs) ? parsed.signs : []).map((s) => {
            const id = slug(s?.id || s?.name) || `sign-${Math.random().toString(36).slice(2, 7)}`;
            return {
                id,
                name: String(s?.name || 'Untitled finding'),
                category: ['inspection', 'palpation', 'percussion', 'auscultation', 'symptom']
                    .includes(String(s?.category)) ? s.category : 'inspection',
                region: s?.region ? String(s.region) : null,
                media: `sign:${id}`,
                short: String(s?.short || ''),
                body: String(s?.body || ''),
                brief: String(s?.brief || ''),
            };
        });
        const signIds = new Set(signs.map((s) => s.id));
        const scenes = (Array.isArray(parsed?.scenes) ? parsed.scenes : []).map((sc) => {
            const id = slug(sc?.id || sc?.title) || 'scene';
            const hotspots = (Array.isArray(sc?.hotspots) ? sc.hotspots : []).map((h) => {
                const x = this.clamp01(h?.x);
                const y = this.clamp01(h?.y);
                const signId = h?.signId ? slug(h.signId) : null;
                const sceneId = h?.sceneId ? slug(h.sceneId) : null;
                if (signId && !signIds.has(signId)) {
                    warnings.push(`Hotspot "${h?.label}" points at a sign that wasn't generated (${signId}).`);
                }
                return {
                    x, y,
                    label: String(h?.label || ''),
                    action: signId ? { type: 'sign', id: signId }
                        : sceneId ? { type: 'scene', id: sceneId }
                            : { type: 'label' },
                };
            });
            return {
                id,
                title: String(sc?.title || id),
                parent: sc?.parent ? slug(sc.parent) : null,
                media: id === 'body' ? 'scene:body' : `scene:${id}`,
                hotspots,
            };
        });
        if (!scenes.length)
            warnings.push('No scenes were generated — add at least a body scene.');
        if (!scenes.some((s) => !s.parent))
            warnings.push('No root scene: one scene must have parent null.');
        const chain = (Array.isArray(parsed?.chain) ? parsed.chain : []).map((c, i) => ({
            step: Number(c?.step) || i + 1,
            title: String(c?.title || `Step ${i + 1}`),
            body: String(c?.body || ''),
            media: `chain:${Number(c?.step) || i + 1}`,
        }));
        const investigations = (Array.isArray(parsed?.investigations) ? parsed.investigations : [])
            .map((ix) => {
            const modality = ['ecg', 'cxr', 'echo', 'labs', 'other'].includes(String(ix?.modality))
                ? ix.modality : 'other';
            return {
                modality,
                ref: null,
                media: `ix:${modality}`,
                findings: Array.isArray(ix?.findings) ? ix.findings.map((f) => String(f)) : [],
            };
        });
        const sounds = (Array.isArray(parsed?.sounds) ? parsed.sounds : []).map((s) => ({
            title: String(s?.title || condition),
            ref: null,
            compareWith: null,
            markers: (Array.isArray(s?.markers) ? s.markers : []).map((m) => ({
                label: String(m?.label || ''),
                from: Number(m?.from) || 0,
                to: Number(m?.to) || 0,
            })),
        }));
        if (sounds.length) {
            warnings.push('Sound steps need an Auscultation card attached before they will play.');
        }
        if (investigations.length) {
            warnings.push('Investigations can be linked to existing ECG cards instead of new uploads.');
        }
        const practice = {
            checklist: (Array.isArray(parsed?.practice?.checklist) ? parsed.practice.checklist : [])
                .map((c) => ({
                section: String(c?.section || 'general'),
                items: Array.isArray(c?.items) ? c.items.map((i) => String(i)) : [],
            })),
            questions: (Array.isArray(parsed?.practice?.questions) ? parsed.practice.questions : [])
                .map((q) => ({ q: String(q?.q || ''), a: String(q?.a || '') })),
        };
        const stepNumbers = new Set(chain.map((c) => Number(c.step)));
        const connectRaw = Array.isArray(parsed?.summaryBlock?.connect)
            ? parsed.summaryBlock.connect : [];
        const connect = connectRaw
            .map((e) => ({ from: String(e?.from || ''), to: Number(e?.to) }))
            .filter((e) => signIds.has(e.from) && stepNumbers.has(e.to));
        const droppedEdges = connectRaw.length - connect.length;
        if (droppedEdges > 0) {
            warnings.push(`${droppedEdges} sign-to-mechanism link${droppedEdges === 1 ? '' : 's'} referenced `
                + 'a finding or step that does not exist and were dropped.');
        }
        const document = {
            version: 1,
            scenes,
            signs,
            chain,
            investigations,
            sounds,
            summary: {
                keyPoints: Array.isArray(parsed?.summaryBlock?.keyPoints)
                    ? parsed.summaryBlock.keyPoints.map((k) => String(k)) : [],
                osceTips: Array.isArray(parsed?.summaryBlock?.osceTips)
                    ? parsed.summaryBlock.osceTips.map((t) => String(t)) : [],
                connect,
            },
            related: (Array.isArray(parsed?.related) ? parsed.related : []).map((r) => ({
                rel: ['cause', 'complication', 'differential'].includes(String(r?.rel)) ? r.rel : 'differential',
                case: slug(r?.case),
                note: r?.note ? String(r.note) : undefined,
            })).filter((r) => r.case),
            practice,
        };
        warnings.unshift('Generated text is a draft — review every finding before publishing.');
        return { summary: String(parsed?.summary || ''), document, warnings };
    }
    clamp01(value) {
        const n = Number(value);
        if (!Number.isFinite(n))
            return 0.5;
        return Math.min(1, Math.max(0, n));
    }
    async resolveProvider() {
        let rows = [];
        try {
            [rows] = await this.db.execute(`SELECT provider_key, provider_label, api_key_encrypted, base_url, model
           FROM ai_provider_configs
          WHERE status = 'active' AND api_key_encrypted IS NOT NULL AND api_key_encrypted <> ''
          ORDER BY is_active DESC, updated_at DESC, id DESC LIMIT 1`);
        }
        catch (error) {
            throw new common_1.ServiceUnavailableException(`Could not look up the AI provider configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
        const row = rows[0];
        if (row) {
            const key = String(row.provider_key || '').trim().toLowerCase();
            if (!(0, ai_provider_utils_1.isAiProviderKey)(key))
                throw new common_1.ServiceUnavailableException('The active AI provider is invalid.');
            return {
                providerKey: key,
                providerLabel: String(row.provider_label || '').trim() || ai_provider_utils_1.AI_PROVIDER_LABELS[key],
                apiKey: this.decrypt(String(row.api_key_encrypted || '')),
                model: String(row.model || '').trim() || (0, ai_provider_utils_1.getDefaultModelForProvider)(key),
                baseUrl: (0, ai_provider_utils_1.normalizeAiProviderBaseUrl)(key, row.base_url),
            };
        }
        for (const [envVar, key] of [
            ['GEMINI_API_KEY', 'gemini'], ['OPENAI_API_KEY', 'openai'], ['OPENROUTER_API_KEY', 'openrouter'],
        ]) {
            const envKey = String(this.config.get(envVar) || '').trim();
            if (envKey) {
                return {
                    providerKey: key,
                    providerLabel: `${ai_provider_utils_1.AI_PROVIDER_LABELS[key]} (.env fallback)`,
                    apiKey: envKey,
                    model: (0, ai_provider_utils_1.getDefaultModelForProvider)(key),
                    baseUrl: (0, ai_provider_utils_1.getDefaultBaseUrlForProvider)(key),
                };
            }
        }
        throw new common_1.ServiceUnavailableException('No active AI provider configured. Add a key in Admin → Settings → AI.');
    }
    decrypt(value) {
        try {
            const secret = String(this.config.get('SETTINGS_ENCRYPTION_KEY') || '').trim()
                || 'lms-dev-settings-key-change-me';
            return (0, ai_provider_utils_1.decryptSecret)(value, secret);
        }
        catch {
            return '';
        }
    }
    async callProvider(prompt, provider, maxOutputTokens = 16384) {
        if (!provider.apiKey) {
            throw new common_1.ServiceUnavailableException(`No API key for ${provider.providerLabel}.`);
        }
        return provider.providerKey === 'gemini'
            ? this.callGemini(prompt, provider, maxOutputTokens)
            : this.callChat(prompt, provider);
    }
    async callGemini(prompt, provider, maxOutputTokens = 16384) {
        const models = Array.from(new Set([provider.model, ...GEMINI_MODELS].filter(Boolean)));
        const errors = [];
        for (const model of models) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
            try {
                const res = await (0, fetch_with_retry_1.fetchWithRetry)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: ctrl.signal,
                    body: JSON.stringify({
                        generationConfig: { responseMimeType: 'application/json', maxOutputTokens },
                        contents: [{ parts: [{ text: prompt }] }],
                    }),
                });
                if (!res.ok) {
                    errors.push(`${model}: HTTP ${res.status}`);
                    continue;
                }
                const json = await res.json();
                const text = json?.candidates?.[0]?.content?.parts
                    ?.find((p) => typeof p?.text === 'string')?.text?.trim();
                if (text)
                    return text;
                errors.push(`${model}: empty response`);
            }
            catch (error) {
                errors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
            }
            finally {
                clearTimeout(timer);
            }
        }
        throw new common_1.ServiceUnavailableException(`Case generation failed. ${errors.join('; ')}`);
    }
    async callChat(prompt, provider) {
        const base = provider.baseUrl || (0, ai_provider_utils_1.getDefaultBaseUrlForProvider)(provider.providerKey);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await (0, fetch_with_retry_1.fetchWithRetry)(`${base.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${provider.apiKey}`,
                },
                signal: ctrl.signal,
                body: JSON.stringify({
                    model: provider.model,
                    response_format: { type: 'json_object' },
                    messages: [{ role: 'user', content: prompt }],
                }),
            });
            if (!res.ok) {
                throw new common_1.ServiceUnavailableException(`${provider.providerLabel}: HTTP ${res.status}`);
            }
            const json = await res.json();
            const text = json?.choices?.[0]?.message?.content?.trim();
            if (!text)
                throw new common_1.ServiceUnavailableException(`${provider.providerLabel} returned nothing.`);
            return text;
        }
        finally {
            clearTimeout(timer);
        }
    }
    parseJson(raw) {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        try {
            return JSON.parse(cleaned);
        }
        catch (error) {
            const looksTruncated = cleaned.length > 400
                && !cleaned.trimEnd().endsWith('}');
            this.logger.error(`OSCE generation returned unparseable JSON (${cleaned.length} chars, `
                + `${looksTruncated ? 'truncated' : 'malformed'}): ${String(error)}`);
            throw new common_1.ServiceUnavailableException(looksTruncated
                ? 'The model ran out of room before finishing the case. Try again, or generate '
                    + 'it with fewer sections and add the rest by hand.'
                : 'The model returned malformed JSON. Try again.');
        }
    }
};
exports.OsceGeneratorService = OsceGeneratorService;
exports.OsceGeneratorService = OsceGeneratorService = OsceGeneratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], OsceGeneratorService);
//# sourceMappingURL=osce-generator.service.js.map