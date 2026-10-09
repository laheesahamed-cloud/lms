import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { fetchWithRetry } from '../../common/utils/fetch-with-retry';
import {
  AI_PROVIDER_LABELS, AiProviderKey, decryptSecret, getDefaultBaseUrlForProvider,
  getDefaultModelForProvider, isAiProviderKey, normalizeAiProviderBaseUrl,
} from '../../common/utils/ai-provider.utils';
import { CaseDocument } from './osce.service';

interface RuntimeProvider {
  providerKey: AiProviderKey;
  providerLabel: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

const REQUEST_TIMEOUT_MS = 120_000;
const GEMINI_MODELS = ['gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash'];

@Injectable()
export class OsceGeneratorService {
  private readonly logger = new Logger(OsceGeneratorService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly config: ConfigService,
  ) {}

  async generateCase(
    condition: string,
    systemKey: string,
    notes?: string,
    stationType: 'short' | 'long' = 'short',
  ) {
    const provider = await this.resolveProvider();
    const prompt = stationType === 'long'
      ? this.buildLongCasePrompt(condition, systemKey, notes)
      : this.buildPrompt(condition, systemKey, notes);
    // A long case is a whole history — seven sections of exchanges runs far
    // longer than a short case and was being truncated mid-JSON at 16k.
    const raw = await this.callProvider(prompt, provider, stationType === 'long' ? 65536 : 16384);
    const parsed = this.parseJson(raw);
    return stationType === 'long'
      ? this.normalizeLongCase(parsed, condition)
      : this.normalize(parsed, condition);
  }

  /**
   * A long case is history-led: the student works through the real exam
   * sequence and the patient answers. Written as an ordered set of sections,
   * each a run of question/answer exchanges the app reveals one at a time.
   */
  private buildLongCasePrompt(condition: string, systemKey: string, notes?: string) {
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
  "treatment": [ { "group": "Immediate | Definitive | Long-term", "items": ["One management step"] } ],
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

  /** Shape the long-case output, keeping the section order the exam uses. */
  private normalizeLongCase(parsed: any, condition: string) {
    const warnings: string[] = [
      'Generated history is a draft — check every answer before publishing.',
    ];
    const slug = (v: string) => String(v || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const sections = (Array.isArray(parsed?.sections) ? parsed.sections : []).map((sec: any, i: number) => ({
      id: slug(sec?.id || sec?.title) || `section-${i + 1}`,
      title: String(sec?.title || `Section ${i + 1}`),
      purpose: String(sec?.purpose || ''),
      exchanges: (Array.isArray(sec?.exchanges) ? sec.exchanges : []).map((ex: any) => ({
        ask: String(ex?.ask || ''),
        reply: String(ex?.reply || ''),
        note: ex?.note ? String(ex.note) : '',
      })).filter((ex: any) => ex.ask || ex.reply),
    })).filter((sec: any) => sec.exchanges.length);

    if (!sections.length) warnings.push('No history sections were generated — add them by hand.');

    const patient = parsed?.patient || {};
    const document: any = {
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
      differentials: (Array.isArray(parsed?.differentials) ? parsed.differentials : []).map((d: any) => ({
        diagnosis: String(d?.diagnosis || ''),
        supporting: String(d?.supporting || ''),
        against: String(d?.against || ''),
      })),
      initialManagement: (Array.isArray(parsed?.initialManagement) ? parsed.initialManagement : [])
        .map((m: any) => String(m)),
      // Unused by a long case, but kept so one document type serves both.
      scenes: [], signs: [], chain: [], investigations: [], sounds: [],
      summary: {
        keyPoints: (parsed?.summaryBlock?.keyPoints || []).map((k: any) => String(k)),
        osceTips: (parsed?.summaryBlock?.osceTips || []).map((t: any) => String(t)),
        connect: [],
      },
      // One shared mapper shape for both station types: anything the model
      // leaves out becomes an empty list rather than an undefined key.
      treatment: (Array.isArray(parsed?.treatment) ? parsed.treatment : [])
        .map((g: any) => ({
          group: String(g?.group || ''),
          items: Array.isArray(g?.items) ? g.items.map((i: any) => String(i)) : [],
        }))
        .filter((g: any) => g.items.length),
      related: [],
      practice: {
        checklist: (Array.isArray(parsed?.practice?.checklist) ? parsed.practice.checklist : [])
          .map((c: any) => ({
            section: String(c?.section || 'history'),
            items: Array.isArray(c?.items) ? c.items.map((i: any) => String(i)) : [],
          })),
        questions: (Array.isArray(parsed?.practice?.questions) ? parsed.practice.questions : [])
          .map((q: any) => ({ q: String(q?.q || ''), a: String(q?.a || '') })),
      },
    };

    return { summary: String(parsed?.summary || ''), document, warnings };
  }

  /**
   * Placeholder imagery for a slot.
   *
   * SmartNotesImageApiService can do this too, but it only reads the key from
   * env — on this deployment the Gemini key lives encrypted in
   * `ai_provider_configs`, so going through our own provider resolution is what
   * makes the admin-panel key actually work.
   */
  async generateImage(prompt: string, preferredModel?: string): Promise<string | null> {
    const provider = await this.resolveProvider();
    if (provider.providerKey !== 'gemini' || !provider.apiKey) return null;

    // The chosen model is tried first, so models can be compared from the panel
    // without a rebuild; the rest are fallbacks.
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
        const res = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctrl.signal,
            body: JSON.stringify({
              generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );
        if (!res.ok) {
          this.logger.warn(`OSCE image model ${model}: HTTP ${res.status}`);
          continue;
        }
        const json = await res.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
        };
        const part = json?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data);
        if (part?.inlineData?.data) {
          // Logged so image spend can be tracked against the provider's rates.
          const u = json.usageMetadata;
          this.logger.log(
            `OSCE image [${model}] tokens in=${u?.promptTokenCount ?? '?'} `
            + `out=${u?.candidatesTokenCount ?? '?'} total=${u?.totalTokenCount ?? '?'}`
          );
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
        this.logger.warn(`OSCE image model ${model} returned no image part`);
      } catch (error) {
        this.logger.warn(`OSCE image model ${model}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  }

  /**
   * The image-capable models this API key can actually reach, so the panel can
   * offer a list instead of asking someone to remember model names.
   */
  async listImageModels(): Promise<Array<{ name: string; label: string; description?: string }>> {
    const provider = await this.resolveProvider();
    if (provider.providerKey !== 'gemini' || !provider.apiKey) return [];

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(provider.apiKey)}`,
        { method: 'GET', signal: ctrl.signal }
      );
      if (!res.ok) {
        this.logger.warn(`Listing image models failed: HTTP ${res.status}`);
        return [];
      }
      const json = await res.json() as {
        models?: Array<{
          name?: string; displayName?: string; description?: string;
          supportedGenerationMethods?: string[];
        }>;
      };

      return (json.models || [])
        .map((m) => ({
          name: String(m.name || '').replace(/^models\//, ''),
          label: String(m.displayName || m.name || ''),
          methods: m.supportedGenerationMethods || [],
          description: String(m.description || ''),
        }))
        // Image generation is advertised either by a dedicated method or, for
        // the multimodal models, by "image" appearing in the model id.
        .filter((m) => m.name && (
          m.methods.some((x) => /image/i.test(x) || x === 'predict')
          || /image/i.test(m.name)
        ))
        .map(({ name, label, description }) => ({ name, label, description }));
    } catch (error) {
      this.logger.warn(`Listing image models failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  /* ─────────────────────── the prompt ──────────────────────── */

  private buildPrompt(condition: string, systemKey: string, notes?: string) {
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
  "treatment": [ { "group": "Immediate | Definitive | Long-term", "items": ["One management step"] } ],
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

  /* ─────────────────── shape the AI output ─────────────────── */

  private normalize(parsed: any, condition: string): {
    summary: string; document: CaseDocument; warnings: string[];
  } {
    const warnings: string[] = [];
    const slug = (v: string) => String(v || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const signs = (Array.isArray(parsed?.signs) ? parsed.signs : []).map((s: any) => {
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
    const signIds = new Set(signs.map((s: any) => s.id));

    const scenes = (Array.isArray(parsed?.scenes) ? parsed.scenes : []).map((sc: any) => {
      const id = slug(sc?.id || sc?.title) || 'scene';
      const hotspots = (Array.isArray(sc?.hotspots) ? sc.hotspots : []).map((h: any) => {
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
          action: signId ? { type: 'sign' as const, id: signId }
                : sceneId ? { type: 'scene' as const, id: sceneId }
                : { type: 'label' as const },
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

    if (!scenes.length) warnings.push('No scenes were generated — add at least a body scene.');
    if (!scenes.some((s: any) => !s.parent)) warnings.push('No root scene: one scene must have parent null.');

    const chain = (Array.isArray(parsed?.chain) ? parsed.chain : []).map((c: any, i: number) => ({
      step: Number(c?.step) || i + 1,
      title: String(c?.title || `Step ${i + 1}`),
      body: String(c?.body || ''),
      media: `chain:${Number(c?.step) || i + 1}`,
    }));

    const investigations = (Array.isArray(parsed?.investigations) ? parsed.investigations : [])
      .map((ix: any) => {
        const modality = ['ecg', 'cxr', 'echo', 'labs', 'other'].includes(String(ix?.modality))
          ? ix.modality : 'other';
        return {
          modality,
          ref: null,
          media: `ix:${modality}`,
          findings: Array.isArray(ix?.findings) ? ix.findings.map((f: any) => String(f)) : [],
        };
      });

    const sounds = (Array.isArray(parsed?.sounds) ? parsed.sounds : []).map((s: any) => ({
      title: String(s?.title || condition),
      ref: null,
      compareWith: null,
      markers: (Array.isArray(s?.markers) ? s.markers : []).map((m: any) => ({
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
        .map((c: any) => ({
          section: String(c?.section || 'general'),
          items: Array.isArray(c?.items) ? c.items.map((i: any) => String(i)) : [],
        })),
      questions: (Array.isArray(parsed?.practice?.questions) ? parsed.practice.questions : [])
        .map((q: any) => ({ q: String(q?.q || ''), a: String(q?.a || '') })),
    };

    // Keep only edges whose sign id and chain step both exist. The model will
    // happily cite a sign it renamed or a step it never wrote, and a dangling
    // edge renders as an orphan row — the same class of bug as a dead related
    // link, so it gets caught here rather than in the app.
    const stepNumbers = new Set(chain.map((c: any) => Number(c.step)));
    const connectRaw = Array.isArray(parsed?.summaryBlock?.connect)
      ? parsed.summaryBlock.connect : [];
    const connect = connectRaw
      .map((e: any) => ({ from: String(e?.from || ''), to: Number(e?.to) }))
      .filter((e: any) => signIds.has(e.from) && stepNumbers.has(e.to));
    const droppedEdges = connectRaw.length - connect.length;
    if (droppedEdges > 0) {
      warnings.push(
        `${droppedEdges} sign-to-mechanism link${droppedEdges === 1 ? '' : 's'} referenced `
        + 'a finding or step that does not exist and were dropped.'
      );
    }

    const document: CaseDocument = {
      version: 1,
      scenes,
      signs,
      chain,
      investigations,
      sounds,
      summary: {
        keyPoints: Array.isArray(parsed?.summaryBlock?.keyPoints)
          ? parsed.summaryBlock.keyPoints.map((k: any) => String(k)) : [],
        osceTips: Array.isArray(parsed?.summaryBlock?.osceTips)
          ? parsed.summaryBlock.osceTips.map((t: any) => String(t)) : [],
        connect,
      },
      // One shared mapper shape for both station types: anything the model
      // leaves out becomes an empty list rather than an undefined key.
      treatment: (Array.isArray(parsed?.treatment) ? parsed.treatment : [])
        .map((g: any) => ({
          group: String(g?.group || ''),
          items: Array.isArray(g?.items) ? g.items.map((i: any) => String(i)) : [],
        }))
        .filter((g: any) => g.items.length),
      related: (Array.isArray(parsed?.related) ? parsed.related : []).map((r: any) => ({
        rel: ['cause', 'complication', 'differential'].includes(String(r?.rel)) ? r.rel : 'differential',
        case: slug(r?.case),
        note: r?.note ? String(r.note) : undefined,
      })).filter((r: any) => r.case),
      practice,
    };

    warnings.unshift('Generated text is a draft — review every finding before publishing.');
    return { summary: String(parsed?.summary || ''), document, warnings };
  }

  private clamp01(value: any) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0.5;
    return Math.min(1, Math.max(0, n));
  }

  /* ───────────────────── provider plumbing ─────────────────── */

  private async resolveProvider(): Promise<RuntimeProvider> {
    type Row = RowDataPacket & {
      provider_key: string; provider_label: string | null;
      api_key_encrypted: string | null; base_url: string | null; model: string | null;
    };
    let rows: Row[] = [];
    try {
      [rows] = await this.db.execute<Row[]>(
        `SELECT provider_key, provider_label, api_key_encrypted, base_url, model
           FROM ai_provider_configs
          WHERE status = 'active' AND api_key_encrypted IS NOT NULL AND api_key_encrypted <> ''
          ORDER BY is_active DESC, updated_at DESC, id DESC LIMIT 1`
      );
    } catch (error) {
      throw new ServiceUnavailableException(
        `Could not look up the AI provider configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const row = rows[0];
    if (row) {
      const key = String(row.provider_key || '').trim().toLowerCase();
      if (!isAiProviderKey(key)) throw new ServiceUnavailableException('The active AI provider is invalid.');
      return {
        providerKey: key,
        providerLabel: String(row.provider_label || '').trim() || AI_PROVIDER_LABELS[key],
        apiKey: this.decrypt(String(row.api_key_encrypted || '')),
        model: String(row.model || '').trim() || getDefaultModelForProvider(key),
        baseUrl: normalizeAiProviderBaseUrl(key, row.base_url),
      };
    }

    for (const [envVar, key] of [
      ['GEMINI_API_KEY', 'gemini'], ['OPENAI_API_KEY', 'openai'], ['OPENROUTER_API_KEY', 'openrouter'],
    ] as Array<[string, AiProviderKey]>) {
      const envKey = String(this.config.get<string>(envVar) || '').trim();
      if (envKey) {
        return {
          providerKey: key,
          providerLabel: `${AI_PROVIDER_LABELS[key]} (.env fallback)`,
          apiKey: envKey,
          model: getDefaultModelForProvider(key),
          baseUrl: getDefaultBaseUrlForProvider(key),
        };
      }
    }

    throw new ServiceUnavailableException(
      'No active AI provider configured. Add a key in Admin → Settings → AI.'
    );
  }

  private decrypt(value: string) {
    try {
      const secret = String(this.config.get<string>('SETTINGS_ENCRYPTION_KEY') || '').trim()
        || 'lms-dev-settings-key-change-me';
      return decryptSecret(value, secret);
    } catch { return ''; }
  }

  private async callProvider(
    prompt: string,
    provider: RuntimeProvider,
    maxOutputTokens = 16384,
  ): Promise<string> {
    if (!provider.apiKey) {
      throw new ServiceUnavailableException(`No API key for ${provider.providerLabel}.`);
    }
    return provider.providerKey === 'gemini'
      ? this.callGemini(prompt, provider, maxOutputTokens)
      : this.callChat(prompt, provider);
  }

  private async callGemini(
    prompt: string,
    provider: RuntimeProvider,
    maxOutputTokens = 16384,
  ): Promise<string> {
    const models = Array.from(new Set([provider.model, ...GEMINI_MODELS].filter(Boolean)));
    const errors: string[] = [];

    for (const model of models) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctrl.signal,
            body: JSON.stringify({
              generationConfig: { responseMimeType: 'application/json', maxOutputTokens },
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );
        if (!res.ok) { errors.push(`${model}: HTTP ${res.status}`); continue; }
        const json = await res.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = json?.candidates?.[0]?.content?.parts
          ?.find((p) => typeof p?.text === 'string')?.text?.trim();
        if (text) return text;
        errors.push(`${model}: empty response`);
      } catch (error) {
        errors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ServiceUnavailableException(`Case generation failed. ${errors.join('; ')}`);
  }

  private async callChat(prompt: string, provider: RuntimeProvider): Promise<string> {
    const base = provider.baseUrl || getDefaultBaseUrlForProvider(provider.providerKey);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetchWithRetry(`${base.replace(/\/+$/, '')}/chat/completions`, {
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
        throw new ServiceUnavailableException(`${provider.providerLabel}: HTTP ${res.status}`);
      }
      const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = json?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new ServiceUnavailableException(`${provider.providerLabel} returned nothing.`);
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseJson(raw: string): any {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (error) {
      const looksTruncated = cleaned.length > 400
        && !cleaned.trimEnd().endsWith('}');
      this.logger.error(
        `OSCE generation returned unparseable JSON (${cleaned.length} chars, `
        + `${looksTruncated ? 'truncated' : 'malformed'}): ${String(error)}`
      );
      throw new ServiceUnavailableException(
        looksTruncated
          ? 'The model ran out of room before finishing the case. Try again, or generate '
            + 'it with fewer sections and add the rest by hand.'
          : 'The model returned malformed JSON. Try again.'
      );
    }
  }
}
