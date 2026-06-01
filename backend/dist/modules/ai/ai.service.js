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
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const generative_ai_1 = require("@google/generative-ai");
const database_tokens_1 = require("../../database/database.tokens");
const ai_provider_utils_1 = require("../../common/utils/ai-provider.utils");
const fetch_with_retry_1 = require("../../common/utils/fetch-with-retry");
const AI_REQUEST_TIMEOUT_MS = 180_000;
let AiService = class AiService {
    constructor(configService, db) {
        this.configService = configService;
        this.db = db;
    }
    normalizeQuizEngineKey(value) {
        return value === 'openai' ? 'openai' : 'gemini';
    }
    async generateQuiz(dto, engineKeyRaw) {
        const prompt = this.buildPrompt(dto);
        const provider = await this.resolveRuntimeProviderForQuizEngine(this.normalizeQuizEngineKey(engineKeyRaw));
        const candidateText = await this.runJsonPrompt(prompt, provider);
        if (!candidateText) {
            throw new common_1.BadGatewayException(`${ai_provider_utils_1.AI_PROVIDER_LABELS[provider.providerKey]} returned an empty response`);
        }
        const structured = this.parseStructuredPayload(candidateText, provider.providerKey);
        const normalizedItems = structured.items.map((item, index) => this.normalizeItem(item, dto, index));
        return {
            ok: true,
            experimental: true,
            source: provider.providerKey,
            generatedAt: new Date().toISOString(),
            provider: {
                id: provider.id,
                key: provider.providerKey,
                label: provider.providerLabel,
                model: provider.model,
                source: provider.source,
            },
            settings: {
                course: dto.course?.trim() || '',
                subject: dto.subject?.trim() || '',
                topic: dto.topic?.trim() || '',
                lesson: dto.lesson?.trim() || '',
                category: dto.category,
                questionType: dto.questionType,
                difficulty: dto.difficulty,
                numberOfQuestions: dto.numberOfQuestions,
                instruction: dto.instruction?.trim() || '',
            },
            items: normalizedItems,
        };
    }
    async beautifyLesson(dto) {
        if (!dto.lessonContent?.trim()) {
            throw new common_1.BadRequestException('Lesson content is required before beautifying notes');
        }
        const provider = await this.resolveRuntimeProvider();
        const candidateText = await this.runJsonPrompt(this.buildBeautifyLessonPrompt(dto), provider);
        const payload = this.parseBeautifiedLessonPayload(candidateText, provider.providerKey);
        return {
            ok: true,
            experimental: true,
            source: provider.providerKey,
            generatedAt: new Date().toISOString(),
            provider: {
                id: provider.id,
                key: provider.providerKey,
                label: provider.providerLabel,
                model: provider.model,
                source: provider.source,
            },
            suggestedTitle: payload.suggestedTitle || dto.lessonTitle?.trim() || 'Untitled lesson',
            beautifiedContent: payload.beautifiedContent,
            shortSummary: payload.shortSummary,
        };
    }
    async generateWhyIncorrect(dto) {
        if (!dto.questionText?.trim()) {
            throw new common_1.BadRequestException('Question text is required');
        }
        const provider = await this.resolveRuntimeProvider();
        const prompt = this.buildWhyIncorrectPrompt(dto);
        const candidateText = await this.runJsonPrompt(prompt, provider);
        const parsed = this.parseJson(candidateText, provider.providerKey);
        const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
        const isTrueFalse = dto.questionType === 'true_false';
        const correctLabel = String(dto.correctAnswerLabel || '').trim().toUpperCase();
        const allowedLabels = new Set((dto.options || [])
            .filter((option) => {
            const label = String(option.optionLabel || '').trim().toUpperCase();
            if (!label || String(option.whyIncorrect || '').trim())
                return false;
            return isTrueFalse || label !== correctLabel;
        })
            .map((option) => String(option.optionLabel || '').trim().toUpperCase()));
        return {
            ok: true,
            source: provider.providerKey,
            generatedAt: new Date().toISOString(),
            items: items
                .map((item) => ({
                optionLabel: this.normalizeString(item?.option_label || item?.optionLabel || item?.label).toUpperCase(),
                whyIncorrect: this.normalizeString(item?.why_incorrect || item?.whyIncorrect || item?.reason),
            }))
                .filter((item) => allowedLabels.has(item.optionLabel) && item.whyIncorrect),
        };
    }
    async generateExplanation(dto) {
        if (!dto.questionText?.trim()) {
            throw new common_1.BadRequestException('Question text is required');
        }
        const provider = await this.resolveRuntimeProvider();
        const candidateText = await this.runJsonPrompt(this.buildExplanationPrompt(dto), provider);
        const parsed = this.parseJson(candidateText, provider.providerKey);
        const explanation = this.normalizeString(parsed?.explanation);
        if (!explanation) {
            throw new common_1.BadGatewayException(`${ai_provider_utils_1.AI_PROVIDER_LABELS[provider.providerKey]} returned an empty explanation`);
        }
        return {
            ok: true,
            source: provider.providerKey,
            generatedAt: new Date().toISOString(),
            explanation,
        };
    }
    async generateTheoryCardFromQuestion(dto) {
        if (!dto.questionText?.trim()) {
            throw new common_1.BadRequestException('Question text is required');
        }
        const correctLabel = String(dto.correctAnswerLabel || '').trim().toUpperCase();
        const recap = await this.generateTheoryRecap({
            questionText: dto.questionText,
            questionType: dto.questionType === 'true_false' ? 'true_false' : 'sba',
            options: (dto.options || []).map((option) => {
                const label = String(option.optionLabel || '').trim().toUpperCase();
                return {
                    optionLabel: label,
                    optionText: String(option.optionText || ''),
                    isCorrect: label === correctLabel || option.isCorrect === 1 || option.isCorrect === true ? 1 : 0,
                };
            }),
            explanation: dto.explanation || '',
            course: dto.course || '',
            subject: dto.subject || '',
            topic: dto.topic || '',
            lesson: dto.lesson || '',
            category: 'mock',
        });
        return {
            ok: true,
            conceptName: recap.concept_name,
            hierarchy: recap.hierarchy,
            etiology: recap.etiology,
            pathophysiology: recap.pathophysiology,
            clinicalFeatures: recap.clinical_features,
            investigations: recap.investigations,
            treatment: recap.treatment,
            keyPoints: recap.key_points,
            mnemonic: recap.mnemonic,
            reviewedStatus: 'pending',
            generatedAt: new Date().toISOString(),
        };
    }
    async generateTheoryRecap(input) {
        const provider = await this.resolveRuntimeProvider();
        const prompt = this.buildTheoryRecapPrompt(input);
        const candidateText = await this.runJsonPrompt(prompt, provider);
        if (!candidateText) {
            throw new common_1.BadGatewayException(`${ai_provider_utils_1.AI_PROVIDER_LABELS[provider.providerKey]} returned an empty response`);
        }
        const parsed = this.parseJson(candidateText, provider.providerKey);
        return {
            concept_name: this.normalizeString(parsed?.concept_name),
            hierarchy: {
                course: this.normalizeString(parsed?.hierarchy?.course, input.course),
                subject: this.normalizeString(parsed?.hierarchy?.subject, input.subject),
                topic: this.normalizeString(parsed?.hierarchy?.topic, input.topic),
                lesson: this.normalizeString(parsed?.hierarchy?.lesson, input.lesson),
            },
            etiology: this.normalizeStringArray(parsed?.etiology),
            pathophysiology: this.normalizeStringArray(parsed?.pathophysiology),
            clinical_features: this.normalizeStringArray(parsed?.clinical_features),
            investigations: this.normalizeStringArray(parsed?.investigations),
            treatment: this.normalizeStringArray(parsed?.treatment),
            key_points: this.normalizeStringArray(parsed?.key_points),
            mnemonic: this.normalizeString(parsed?.mnemonic),
        };
    }
    buildTheoryRecapPrompt(input) {
        const correctAnswers = input.options
            .filter((opt) => opt.isCorrect === 1)
            .map((opt) => `${opt.optionLabel}. ${opt.optionText}`)
            .join('; ');
        const allOptions = input.options
            .map((opt) => `${opt.optionLabel}. ${opt.optionText}${opt.isCorrect === 1 ? ' [CORRECT]' : ''}`)
            .join('\n');
        return [
            'You are a medical education assistant generating a Quick Theory Recap for a student revision tool.',
            'Return strict JSON only with no markdown fences and no extra commentary.',
            'Keep every list short (3–6 bullet points maximum). Use simple, exam-focused language.',
            'Do not repeat the question or the answer options verbatim. Summarize the underlying concept instead.',
            'For "clinical_features", include the clinical picture plus key examination findings and signs when relevant.',
            '',
            `Question type: ${input.questionType === 'sba' ? 'Single Best Answer (SBA)' : 'True/False'}`,
            `Category: ${input.category || 'mock'}`,
            `Course: ${input.course || 'Not specified'}`,
            `Subject: ${input.subject || 'Not specified'}`,
            `Topic: ${input.topic || 'Not specified'}`,
            `Lesson: ${input.lesson || 'Not specified'}`,
            '',
            `Question:\n${input.questionText}`,
            '',
            `Options:\n${allOptions}`,
            '',
            `Correct answer(s): ${correctAnswers || 'Not provided'}`,
            '',
            input.explanation ? `Explanation:\n${input.explanation}` : '',
            '',
            `Return strict JSON only with this shape:
{
  "concept_name": "string (the disease/concept this question tests)",
  "hierarchy": {
    "course": "string",
    "subject": "string",
    "topic": "string",
    "lesson": "string"
  },
  "etiology": ["string", "string"],
  "pathophysiology": ["string", "string"],
  "clinical_features": ["string (symptoms, signs, and examination findings)", "string"],
  "investigations": ["string", "string"],
  "treatment": ["string", "string"],
  "key_points": ["string", "string"],
  "mnemonic": "string (one short mnemonic or memory tip, or empty string)"
}`,
        ]
            .filter(Boolean)
            .join('\n');
    }
    buildWhyIncorrectPrompt(input) {
        if (input.questionType === 'true_false') {
            const statements = (input.options || [])
                .map((option) => {
                const label = String(option.optionLabel || '').trim().toUpperCase();
                const answer = option.isCorrect === 1 || option.isCorrect === true ? 'True' : 'False';
                const existing = String(option.whyIncorrect || '').trim();
                return `${label}. ${option.optionText} [ANSWER: ${answer}]${existing ? ' [already has reason]' : ''}`;
            })
                .join('\n');
            return [
                'You are a senior medical educator helping an admin improve True/False statement explanations.',
                'Return strict JSON only. No markdown fences. No extra commentary.',
                'Do not change the question, statements, or True/False answers.',
                'Only write short medically accurate reasons for statements that are missing a reason.',
                'Each reason should explain why the marked True/False answer is correct.',
                '',
                `Question:\n${input.questionText}`,
                '',
                `Statements:\n${statements}`,
                '',
                input.explanation ? `Main explanation:\n${input.explanation}` : '',
                '',
                `Return this JSON shape:
{
  "items": [
    { "option_label": "A", "why_incorrect": "string" }
  ]
}`,
            ].filter(Boolean).join('\n');
        }
        const correctLabel = String(input.correctAnswerLabel || '').trim().toUpperCase();
        const options = (input.options || [])
            .map((option) => {
            const label = String(option.optionLabel || '').trim().toUpperCase();
            const isCorrect = label === correctLabel || option.isCorrect === 1 || option.isCorrect === true;
            const existing = String(option.whyIncorrect || '').trim();
            return `${label}. ${option.optionText}${isCorrect ? ' [CORRECT - DO NOT EXPLAIN AS WRONG]' : ''}${existing ? ' [already has explanation]' : ''}`;
        })
            .join('\n');
        return [
            'You are a senior medical educator helping an admin improve SBA answer explanations.',
            'Return strict JSON only. No markdown fences. No extra commentary.',
            'Do not change the question, answer options, or correct answer.',
            'Only write short medically accurate reasons for incorrect options that are missing a reason.',
            'Do not include the correct option in the response.',
            'Each reason should be one concise sentence, exam-focused, and explain why that option is not the best answer.',
            '',
            `Question:\n${input.questionText}`,
            '',
            `Correct answer label: ${correctLabel}`,
            '',
            `Options:\n${options}`,
            '',
            input.explanation ? `Main explanation:\n${input.explanation}` : '',
            '',
            `Return this JSON shape:
{
  "items": [
    { "option_label": "A", "why_incorrect": "string" }
  ]
}`,
        ].filter(Boolean).join('\n');
    }
    buildExplanationPrompt(input) {
        const correctLabel = String(input.correctAnswerLabel || '').trim().toUpperCase();
        const options = (input.options || [])
            .map((option) => {
            const label = String(option.optionLabel || '').trim().toUpperCase();
            const isCorrect = label === correctLabel || option.isCorrect === 1 || option.isCorrect === true;
            return `${label}. ${option.optionText}${isCorrect ? ' [CORRECT]' : ''}`;
        })
            .join('\n');
        return [
            'You are a senior medical educator writing the main answer explanation for a question bank.',
            'Return strict JSON only. No markdown fences. No extra commentary.',
            'Do not change the question text, answer options, or correct answer.',
            'Write only the main explanation: why the correct answer is best and the key concept being tested.',
            'Keep it concise, medically accurate, academic, and exam-focused for medical students.',
            'Do not include separate why-incorrect explanations in this response.',
            '',
            `Question type: ${input.questionType === 'true_false' ? 'True/False' : 'Single Best Answer (SBA)'}`,
            `Course: ${input.course || 'Not specified'}`,
            `Subject: ${input.subject || 'Not specified'}`,
            `Topic: ${input.topic || 'Not specified'}`,
            `Lesson: ${input.lesson || 'Not specified'}`,
            '',
            `Question:\n${input.questionText}`,
            '',
            `Correct answer label: ${correctLabel}`,
            '',
            `Options:\n${options}`,
            '',
            `Return this JSON shape:
{
  "explanation": "string"
}`,
        ].filter(Boolean).join('\n');
    }
    normalizeStringArray(value) {
        if (!Array.isArray(value))
            return [];
        return value.map((item) => this.normalizeString(item)).filter(Boolean);
    }
    buildPrompt(dto) {
        const includeExplanations = dto.includeExplanations !== false;
        const includeWhyIncorrect = dto.includeWhyIncorrect === true;
        const hierarchyLines = [
            dto.course?.trim() ? `course: ${dto.course.trim()}` : '',
            dto.subject?.trim() ? `subject: ${dto.subject.trim()}` : '',
            dto.topic?.trim() ? `topic: ${dto.topic.trim()}` : '',
            dto.lesson?.trim() ? `lesson: ${dto.lesson.trim()}` : '',
        ].filter(Boolean);
        const topicContext = [
            dto.course?.trim() ? `course ${dto.course.trim()}` : '',
            dto.subject?.trim() ? `subject ${dto.subject.trim()}` : '',
            dto.topic?.trim() ? `topic ${dto.topic.trim()}` : '',
            dto.lesson?.trim() ? `lesson ${dto.lesson.trim()}` : '',
        ].filter(Boolean);
        const automaticMedicalPrompt = [
            `Create ${dto.questionType === 'sba' ? 'SBA' : 'True/False'} questions related to clinical and theoretical knowledge for a medical student.`,
            topicContext.length > 0 ? `Focus the questions on ${topicContext.join(', ')}.` : '',
            dto.category === 'past_paper'
                ? 'Style the questions with an exam-oriented past paper tone.'
                : 'Style the questions as strong mock revision material.',
            `Keep the difficulty at ${dto.difficulty} level.`,
            'Make the wording medically accurate, educational, and appropriate for revision.',
        ]
            .filter(Boolean)
            .join(' ');
        const schema = dto.questionType === 'sba'
            ? `Return strict JSON only with this shape:
{
  "items": [
    {
      "question_type": "sba",
      "question_text": "string",
      "options": [
        { "text": "string", "why_incorrect": "string" },
        { "text": "string", "why_incorrect": "string" },
        { "text": "string", "why_incorrect": "string" },
        { "text": "string", "why_incorrect": "string" },
        { "text": "string", "why_incorrect": "string" }
      ],
      "correct_answer": "string",
      "explanation": "string",
      "course": "string",
      "subject": "string",
      "topic": "string",
      "lesson": "string",
      "category": "${dto.category}",
      "difficulty": "${dto.difficulty}"
    }
  ]
}`
            : `Return strict JSON only with this shape:
{
  "items": [
    {
      "question_type": "true_false",
      "question_text": "string",
      "statements": [
        { "text": "string", "answer": true, "why_incorrect": "string" },
        { "text": "string", "answer": false, "why_incorrect": "string" },
        { "text": "string", "answer": true, "why_incorrect": "string" },
        { "text": "string", "answer": false, "why_incorrect": "string" },
        { "text": "string", "answer": true, "why_incorrect": "string" }
      ],
      "explanation": "string",
      "course": "string",
      "subject": "string",
      "topic": "string",
      "lesson": "string",
      "category": "${dto.category}",
      "difficulty": "${dto.difficulty}"
    }
  ]
}`;
        return [
            'You are generating quiz content for an experimental LMS AI quiz generator.',
            'This content is for preview only and must be returned as valid JSON with no markdown fences, no commentary, and no extra prose.',
            `Generate exactly ${dto.numberOfQuestions} question(s).`,
            `Question type: ${dto.questionType}.`,
            `Difficulty: ${dto.difficulty}.`,
            `Category: ${dto.category}.`,
            'Use medically relevant, exam-style wording where appropriate, but keep the content clear and educational.',
            'If the type is "sba", always produce exactly 5 answer options and exactly 1 correct answer.',
            'If the type is "true_false", always produce exactly 5 statements and each statement must have a boolean answer.',
            includeExplanations
                ? 'Every question must include a concise explanation.'
                : 'Set explanation to an empty string for every question.',
            includeWhyIncorrect
                ? 'For SBA, include a short why_incorrect reason for every incorrect option and an empty why_incorrect for the correct option.'
                : 'For SBA, set every option why_incorrect to an empty string.',
            includeWhyIncorrect
                ? 'For True/False, include a short reason in why_incorrect for each statement explaining why the true/false answer is correct.'
                : 'For True/False, set every statement why_incorrect to an empty string.',
            'Preserve the requested hierarchy values in every item. If any field is blank, return an empty string for it.',
            `Automatic LMS prompt context: ${automaticMedicalPrompt}`,
            hierarchyLines.length > 0 ? hierarchyLines.join('\n') : 'No hierarchy values were selected.',
            dto.instruction?.trim() ? `Additional free-text instruction from admin: ${dto.instruction.trim()}` : '',
            schema,
        ]
            .filter(Boolean)
            .join('\n\n');
    }
    buildBeautifyLessonPrompt(dto) {
        const hierarchyLines = [
            dto.course?.trim() ? `course: ${dto.course.trim()}` : '',
            dto.subject?.trim() ? `subject: ${dto.subject.trim()}` : '',
            dto.topic?.trim() ? `topic: ${dto.topic.trim()}` : '',
            dto.subtopic?.trim() ? `subtopic: ${dto.subtopic.trim()}` : '',
            dto.lessonTitle?.trim() ? `current lesson title: ${dto.lessonTitle.trim()}` : '',
        ].filter(Boolean);
        return [
            'You are helping an LMS admin turn rough medical lesson text into beautiful, student-friendly revision notes.',
            'Return strict JSON only with no markdown fences and no extra commentary.',
            'The content must remain medically accurate and preserve the original meaning.',
            'Rewrite the lesson into clean, visually structured study notes using plain text only.',
            'Use short section headings, readable spacing, bullet points, arrows, emphasis markers, and concise exam-style phrasing.',
            'Do not include HTML tags.',
            'Prefer a notebook-friendly style that looks good when rendered as styled text in the LMS.',
            'If the source text is messy, organize it into a logical flow such as overview, key points, classification, features, diagnosis, treatment, and red flags where relevant.',
            'Keep the output detailed enough for study use, not over-compressed.',
            hierarchyLines.length > 0 ? hierarchyLines.join('\n') : 'No hierarchy values were selected.',
            `Source lesson content:\n${dto.lessonContent.trim()}`,
            `Return strict JSON only with this shape:
{
  "suggestedTitle": "string",
  "shortSummary": "string",
  "beautifiedContent": "string"
}`,
        ]
            .filter(Boolean)
            .join('\n\n');
    }
    parseStructuredPayload(candidateText, providerKey) {
        const cleaned = this.cleanJsonCandidate(candidateText);
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        }
        catch {
            throw new common_1.BadGatewayException(`${ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey]} returned malformed JSON`);
        }
        if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
            throw new common_1.BadGatewayException(`${ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey]} response did not include any quiz items`);
        }
        return parsed;
    }
    parseBeautifiedLessonPayload(candidateText, providerKey) {
        const parsed = this.parseJson(candidateText, providerKey);
        if (!parsed || typeof parsed !== 'object') {
            throw new common_1.BadGatewayException(`${ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey]} returned malformed lesson JSON`);
        }
        const beautifiedContent = this.normalizeString(parsed.beautifiedContent);
        if (!beautifiedContent) {
            throw new common_1.BadGatewayException(`${ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey]} did not return beautified lesson content`);
        }
        return {
            suggestedTitle: this.normalizeString(parsed.suggestedTitle),
            shortSummary: this.normalizeString(parsed.shortSummary),
            beautifiedContent,
        };
    }
    parseJson(candidateText, providerKey) {
        try {
            return JSON.parse(this.cleanJsonCandidate(candidateText));
        }
        catch {
            throw new common_1.BadGatewayException(`${ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey]} returned malformed JSON`);
        }
    }
    cleanJsonCandidate(candidateText) {
        return candidateText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
    }
    async runJsonPrompt(prompt, provider) {
        if (!provider.apiKey) {
            throw new common_1.InternalServerErrorException(`${provider.providerLabel} is selected as the active AI provider, but it has no API key saved in admin settings.`);
        }
        try {
            switch (provider.providerKey) {
                case 'gemini':
                    return await this.sendGeminiPrompt(provider, prompt);
                case 'openai':
                    return await this.sendOpenAiPrompt(provider, prompt);
                case 'claude':
                    return await this.sendClaudePrompt(provider, prompt);
                case 'openrouter':
                default:
                    return await this.sendOpenRouterPrompt(provider, prompt);
            }
        }
        catch (error) {
            if (error instanceof common_1.BadGatewayException || error instanceof common_1.InternalServerErrorException) {
                throw error;
            }
            const message = this.extractErrorMessage(error);
            const normalized = message.toLowerCase();
            const isTimeout = normalized.includes('timed out') || normalized.includes('abort') || normalized.includes('timeout');
            const isSocket = normalized.includes('socket') ||
                normalized.includes('fetch failed') ||
                normalized.includes('econnreset') ||
                normalized.includes('und_err_socket') ||
                normalized.includes('terminated');
            if (isTimeout) {
                throw new common_1.BadGatewayException(`${provider.providerLabel} did not respond within ${AI_REQUEST_TIMEOUT_MS / 1000} seconds. Try again or switch to a faster model.`);
            }
            if (isSocket) {
                throw new common_1.BadGatewayException(`${provider.providerLabel} connection was interrupted. Check your internet connection and try again.`);
            }
            throw new common_1.BadGatewayException(this.formatProviderError(provider.providerKey, error, provider.model));
        }
    }
    async sendOpenRouterPrompt(provider, prompt) {
        const siteUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5174';
        const siteName = 'xyndrome';
        const response = await (0, fetch_with_retry_1.fetchWithRetry)((0, ai_provider_utils_1.normalizeAiProviderBaseUrl)('openrouter', provider.baseUrl), {
            method: 'POST',
            signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
            headers: {
                Authorization: `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': siteUrl,
                'X-Title': siteName,
            },
            body: JSON.stringify({
                model: provider.model,
                temperature: 0.7,
                top_p: 0.9,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: 'Return valid JSON only. Do not use markdown fences. Do not add commentary before or after the JSON.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        });
        const rawPayload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new common_1.BadGatewayException(this.formatProviderError('openrouter', this.extractOpenRouterError(rawPayload), provider.model));
        }
        const text = this.extractChatCompletionText(rawPayload);
        if (!text) {
            throw new common_1.BadGatewayException('OpenRouter returned an empty completion');
        }
        return text.trim();
    }
    async sendOpenAiPrompt(provider, prompt) {
        let text = '';
        try {
            text = await this.sendOpenAiJsonRequest(provider, prompt, true);
        }
        catch (error) {
            const message = this.extractErrorMessage(error);
            if (!this.isUnsupportedOpenAiJsonModeError(message)) {
                throw error;
            }
            text = await this.sendOpenAiJsonRequest(provider, prompt, false);
        }
        if (!text) {
            throw new common_1.BadGatewayException('OpenAI returned an empty completion');
        }
        return text.trim();
    }
    async sendClaudePrompt(provider, prompt) {
        const response = await (0, fetch_with_retry_1.fetchWithRetry)((0, ai_provider_utils_1.normalizeAiProviderBaseUrl)('claude', provider.baseUrl), {
            method: 'POST',
            signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
            headers: {
                'x-api-key': provider.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: provider.model,
                max_tokens: 4000,
                system: 'Return valid JSON only. Do not use markdown fences. Do not add commentary before or after the JSON.',
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        });
        const rawPayload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new common_1.BadGatewayException(this.formatProviderError('claude', this.extractGenericApiError(rawPayload), provider.model));
        }
        const text = this.extractClaudeText(rawPayload);
        if (!text) {
            throw new common_1.BadGatewayException('Claude returned an empty completion');
        }
        return text.trim();
    }
    async sendGeminiPrompt(provider, prompt) {
        const client = new generative_ai_1.GoogleGenerativeAI(provider.apiKey);
        const model = client.getGenerativeModel({
            model: provider.model,
            generationConfig: {
                temperature: 0.7,
                topP: 0.9,
                responseMimeType: 'application/json',
            },
        });
        for (let attempt = 0; attempt <= 3; attempt += 1) {
            try {
                const result = await model.generateContent([
                    'Return valid JSON only. Do not use markdown fences. Do not add commentary before or after the JSON.',
                    prompt,
                ]);
                const text = result.response.text();
                if (!text?.trim()) {
                    throw new common_1.BadGatewayException('Gemini returned an empty completion');
                }
                return text.trim();
            }
            catch (error) {
                if (error instanceof common_1.BadGatewayException) {
                    throw error;
                }
                const message = this.extractErrorMessage(error);
                const retryable = message.toLowerCase().includes('socket') ||
                    message.toLowerCase().includes('fetch failed') ||
                    message.toLowerCase().includes('econnreset') ||
                    message.toLowerCase().includes('und_err_socket') ||
                    message.toLowerCase().includes('terminated');
                if (!retryable || attempt === 3) {
                    throw new common_1.BadGatewayException(this.formatProviderError('gemini', message, provider.model));
                }
                await new Promise((resolve) => setTimeout(resolve, 1500 * 2 ** attempt + Math.floor(Math.random() * 300)));
            }
        }
        throw new common_1.BadGatewayException('Gemini request failed after retries');
    }
    async resolveRuntimeProvider() {
        const configuredProvider = await this.getActiveAiProviderFromSettings();
        if (configuredProvider) {
            return configuredProvider;
        }
        const envApiKey = String(this.configService.get('OPENROUTER_API_KEY') || '').trim();
        if (envApiKey) {
            return {
                id: null,
                providerKey: 'openrouter',
                providerLabel: 'OpenRouter (.env fallback)',
                apiKey: envApiKey,
                apiCode: '',
                baseUrl: (0, ai_provider_utils_1.getDefaultBaseUrlForProvider)('openrouter'),
                model: String(this.configService.get('OPENROUTER_MODEL') || (0, ai_provider_utils_1.getDefaultModelForProvider)('openrouter')).trim(),
                source: 'env',
            };
        }
        throw new common_1.InternalServerErrorException('No active AI provider is configured. Add and activate a provider in admin settings, or set OPENROUTER_API_KEY in backend/.env as a temporary fallback.');
    }
    async resolveRuntimeProviderForQuizEngine(engineKey) {
        const configuredProvider = await this.getProviderByKeyFromSettings(engineKey);
        if (configuredProvider) {
            return configuredProvider;
        }
        if (engineKey === 'openai') {
            const envApiKey = String(this.configService.get('OPENAI_API_KEY') || '').trim();
            if (envApiKey) {
                return {
                    id: null,
                    providerKey: 'openai',
                    providerLabel: 'ChatGPT / OpenAI (.env fallback)',
                    apiKey: envApiKey,
                    apiCode: '',
                    baseUrl: (0, ai_provider_utils_1.getDefaultBaseUrlForProvider)('openai'),
                    model: String(this.configService.get('OPENAI_MODEL') || (0, ai_provider_utils_1.getDefaultModelForProvider)('openai')).trim(),
                    source: 'env',
                };
            }
            throw new common_1.InternalServerErrorException('No OpenAI provider is configured for the ChatGPT quiz generator. Save an OpenAI key in admin settings or set OPENAI_API_KEY in backend/.env.');
        }
        const envGeminiKey = String(this.configService.get('GEMINI_API_KEY') || '').trim();
        if (envGeminiKey) {
            return {
                id: null,
                providerKey: 'gemini',
                providerLabel: 'Gemini (.env fallback)',
                apiKey: envGeminiKey,
                apiCode: '',
                baseUrl: '',
                model: String(this.configService.get('GEMINI_MODEL') || (0, ai_provider_utils_1.getDefaultModelForProvider)('gemini')).trim(),
                source: 'env',
            };
        }
        throw new common_1.InternalServerErrorException('No Gemini provider is configured for the Gemini quiz generator. Save a Gemini key in admin settings or set GEMINI_API_KEY in backend/.env.');
    }
    async getActiveAiProviderFromSettings() {
        const [rows] = await this.db.execute(`
        SELECT
          id,
          provider_key,
          provider_label,
          api_key_encrypted,
          api_code_encrypted,
          base_url,
          model
        FROM ai_provider_configs
        WHERE is_active = 1 AND status = 'active'
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `);
        const row = rows[0];
        if (!row) {
            return null;
        }
        const normalizedKey = String(row.provider_key || '').trim().toLowerCase();
        if (!(0, ai_provider_utils_1.isAiProviderKey)(normalizedKey)) {
            throw new common_1.InternalServerErrorException('The active AI provider in settings is invalid');
        }
        return {
            id: row.id,
            providerKey: normalizedKey,
            providerLabel: String(row.provider_label || '').trim() || ai_provider_utils_1.AI_PROVIDER_LABELS[normalizedKey],
            apiKey: this.safeDecryptSecret(String(row.api_key_encrypted || '')),
            apiCode: this.safeDecryptSecret(String(row.api_code_encrypted || '')),
            baseUrl: (0, ai_provider_utils_1.normalizeAiProviderBaseUrl)(normalizedKey, row.base_url),
            model: String(row.model || '').trim() || (0, ai_provider_utils_1.getDefaultModelForProvider)(normalizedKey),
            source: 'settings',
        };
    }
    async getProviderByKeyFromSettings(providerKey) {
        const [rows] = await this.db.execute(`
        SELECT
          id,
          provider_key,
          provider_label,
          api_key_encrypted,
          api_code_encrypted,
          base_url,
          model
        FROM ai_provider_configs
        WHERE provider_key = ? AND status = 'active'
        ORDER BY is_active DESC, updated_at DESC, id DESC
        LIMIT 1
      `, [providerKey]);
        const row = rows[0];
        if (!row)
            return null;
        return {
            id: row.id,
            providerKey,
            providerLabel: String(row.provider_label || '').trim() || ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey],
            apiKey: this.safeDecryptSecret(String(row.api_key_encrypted || '')),
            apiCode: this.safeDecryptSecret(String(row.api_code_encrypted || '')),
            baseUrl: (0, ai_provider_utils_1.normalizeAiProviderBaseUrl)(providerKey, row.base_url),
            model: String(row.model || '').trim() || (0, ai_provider_utils_1.getDefaultModelForProvider)(providerKey),
            source: 'settings',
        };
    }
    async sendOpenAiJsonRequest(provider, prompt, useJsonMode) {
        const response = await (0, fetch_with_retry_1.fetchWithRetry)((0, ai_provider_utils_1.normalizeAiProviderBaseUrl)('openai', provider.baseUrl), {
            method: 'POST',
            signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
            headers: {
                Authorization: `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: provider.model,
                temperature: 0.7,
                top_p: 0.9,
                ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
                messages: [
                    {
                        role: 'system',
                        content: useJsonMode
                            ? 'Return valid JSON only. Do not use markdown fences. Do not add commentary before or after the JSON.'
                            : 'Return ONLY raw valid JSON. No markdown fences. No prose. No commentary. Start with { and end with }.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        });
        const rawPayload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new common_1.BadGatewayException(this.formatProviderError('openai', this.extractGenericApiError(rawPayload), provider.model));
        }
        return this.extractChatCompletionText(rawPayload).trim();
    }
    isUnsupportedOpenAiJsonModeError(message) {
        const normalized = String(message || '').toLowerCase();
        return normalized.includes('response_format')
            && (normalized.includes('not supported') || normalized.includes('invalid parameter'));
    }
    safeDecryptSecret(value) {
        try {
            return (0, ai_provider_utils_1.decryptSecret)(value, this.getEncryptionSecret());
        }
        catch {
            return '';
        }
    }
    getEncryptionSecret() {
        const configured = String(this.configService.get('SETTINGS_ENCRYPTION_KEY') || '').trim();
        const nodeEnv = String(this.configService.get('NODE_ENV') || 'development').trim();
        if (!configured && nodeEnv === 'production') {
            throw new common_1.BadRequestException('SETTINGS_ENCRYPTION_KEY must be configured before using saved AI provider secrets');
        }
        return configured || 'lms-dev-settings-key-change-me';
    }
    extractChatCompletionText(payload) {
        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            return content
                .map((part) => {
                if (typeof part === 'string') {
                    return part;
                }
                if (typeof part?.text === 'string') {
                    return part.text;
                }
                return '';
            })
                .join('')
                .trim();
        }
        return '';
    }
    extractClaudeText(payload) {
        const content = payload?.content;
        if (!Array.isArray(content)) {
            return '';
        }
        return content
            .map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .join('')
            .trim();
    }
    extractOpenRouterError(payload) {
        const candidates = [
            payload?.error?.metadata?.raw,
            payload?.error?.metadata?.provider_error,
            payload?.error?.metadata?.reason,
            payload?.error?.message,
            payload?.message,
            payload?.error?.code,
        ];
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) {
                return candidate.trim();
            }
        }
        return 'Unknown OpenRouter error';
    }
    extractGenericApiError(payload) {
        const candidates = [payload?.error?.message, payload?.message, payload?.error?.type, payload?.error];
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) {
                return candidate.trim();
            }
        }
        return 'Unknown provider error';
    }
    normalizeItem(item, dto, index) {
        const base = {
            question_type: dto.questionType,
            course: this.normalizeString(item.course, dto.course),
            subject: this.normalizeString(item.subject, dto.subject),
            topic: this.normalizeString(item.topic, dto.topic),
            lesson: this.normalizeString(item.lesson, dto.lesson),
            category: dto.category,
            difficulty: dto.difficulty,
            explanation: this.normalizeString(item.explanation),
            question_text: this.normalizeString(item.question_text ?? item.questionText ?? item.question),
        };
        if (!base.question_text) {
            throw new common_1.BadGatewayException(`Generated item ${index + 1} is missing question_text`);
        }
        if (dto.questionType === 'sba') {
            const options = Array.isArray(item.options)
                ? item.options.map((option) => {
                    if (typeof option === 'object' && option !== null) {
                        return {
                            text: this.normalizeString(option.text ?? option.option_text ?? option.optionText),
                            why_incorrect: this.normalizeString(option.why_incorrect ?? option.whyIncorrect ?? option.reason ?? option.explanation),
                        };
                    }
                    return {
                        text: this.normalizeString(option),
                        why_incorrect: '',
                    };
                }).filter((option) => option.text)
                : [];
            if (options.length !== 5) {
                throw new common_1.BadGatewayException(`Generated SBA item ${index + 1} must contain exactly 5 options`);
            }
            const correctAnswer = this.normalizeString(item.correct_answer ?? item.correctAnswer)
                || this.normalizeCorrectOptionLabel(item.options);
            if (!correctAnswer) {
                throw new common_1.BadGatewayException(`Generated SBA item ${index + 1} is missing correct_answer`);
            }
            return {
                ...base,
                question_type: 'sba',
                options,
                correct_answer: correctAnswer,
            };
        }
        const rawStatements = Array.isArray(item.statements)
            ? item.statements
            : Array.isArray(item.options)
                ? item.options
                : [];
        const statements = rawStatements
            .map((statement) => ({
            text: this.normalizeString(statement?.text ?? statement?.statement ?? statement?.option_text ?? statement?.optionText),
            answer: this.normalizeBooleanValue(statement?.answer ?? statement?.isTrue ?? statement?.is_true ?? statement?.isCorrect ?? statement?.is_correct),
            why_incorrect: this.normalizeString(statement?.why_incorrect ?? statement?.whyIncorrect ?? statement?.reason ?? statement?.explanation),
        }))
            .filter((statement) => statement.text);
        if (statements.length !== 5) {
            throw new common_1.BadGatewayException(`Generated True/False item ${index + 1} must contain exactly 5 statements`);
        }
        const invalidStatement = statements.find((statement) => statement.answer === null);
        if (invalidStatement) {
            throw new common_1.BadGatewayException(`Generated True/False item ${index + 1} contains a statement with an invalid true/false value`);
        }
        return {
            ...base,
            question_type: 'true_false',
            statements: statements,
        };
    }
    normalizeString(value, fallback = '') {
        return typeof value === 'string' ? value.trim() : String(fallback || '').trim();
    }
    normalizeCorrectOptionLabel(options) {
        if (!Array.isArray(options))
            return '';
        const index = options.findIndex((option) => {
            const value = option?.is_correct ?? option?.isCorrect ?? option?.correct;
            return value === true || value === 1 || String(value || '').trim().toLowerCase() === 'true';
        });
        if (index < 0)
            return '';
        const option = options[index];
        return this.normalizeString(option?.label).toUpperCase() || String.fromCharCode(65 + index);
    }
    normalizeBooleanValue(value) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            if (value === 1) {
                return true;
            }
            if (value === 0) {
                return false;
            }
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['true', 't', 'yes', 'y', '1'].includes(normalized)) {
                return true;
            }
            if (['false', 'f', 'no', 'n', '0'].includes(normalized)) {
                return false;
            }
        }
        return null;
    }
    formatProviderError(providerKey, error, modelName = '') {
        const rawMessage = this.extractErrorMessage(error);
        const normalized = rawMessage.toLowerCase();
        const providerLabel = ai_provider_utils_1.AI_PROVIDER_LABELS[providerKey];
        if (normalized.includes('fetch failed') ||
            normalized.includes('socket connection was closed') ||
            normalized.includes('connectionclosed') ||
            normalized.includes('econnreset')) {
            return `${providerLabel} could not be reached while calling ${modelName || providerKey}. Check the internet connection, firewall, proxy, DNS, or custom base URL.`;
        }
        if (normalized.includes('401') || normalized.includes('unauthorized') || normalized.includes('invalid api key')) {
            return `${providerLabel} rejected the credential. Update the API key in admin settings, then try again.`;
        }
        if (normalized.includes('403') || normalized.includes('forbidden')) {
            return `${providerLabel} denied this request. Check account access, project permissions, model availability, or provider billing.`;
        }
        if (normalized.includes('429') || normalized.includes('rate limit') || normalized.includes('quota') || normalized.includes('credits')) {
            return `${providerLabel} rate limits or quota were hit. Wait a moment or review the provider account usage.`;
        }
        if (normalized.includes('model not found') || normalized.includes('no such model')) {
            return `${providerLabel} cannot find the model "${modelName}". Update the model value in admin settings.`;
        }
        return `${providerLabel} request failed: ${rawMessage}`;
    }
    extractErrorMessage(error) {
        if (error instanceof Error && error.message) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        return 'Unknown error';
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [config_1.ConfigService, Object])
], AiService);
//# sourceMappingURL=ai.service.js.map