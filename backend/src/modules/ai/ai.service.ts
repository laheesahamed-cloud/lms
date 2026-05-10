import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import {
  AI_PROVIDER_LABELS,
  AiProviderKey,
  decryptSecret,
  getDefaultBaseUrlForProvider,
  getDefaultModelForProvider,
  isAiProviderKey,
  normalizeAiProviderBaseUrl,
} from '../../utils/ai-provider.utils';
import { fetchWithRetry } from '../../utils/fetch-with-retry';
import { BeautifyLessonDto } from './dto/beautify-lesson.dto';
import { GenerateAiQuizDto } from './dto/generate-ai-quiz.dto';
import { GenerateWhyIncorrectDto } from './dto/generate-why-incorrect.dto';
import { GenerateExplanationDto } from './dto/generate-explanation.dto';

const AI_REQUEST_TIMEOUT_MS = 180_000;

export type TheoryRecapInput = {
  questionText: string;
  questionType: 'sba' | 'true_false';
  options: Array<{ optionLabel: string; optionText: string; isCorrect: number }>;
  explanation: string;
  course: string;
  subject: string;
  topic: string;
  lesson: string;
  category: string;
};

export type TheoryRecapPayload = {
  concept_name: string;
  hierarchy: { course: string; subject: string; topic: string; lesson: string };
  etiology: string[];
  pathophysiology: string[];
  clinical_features: string[];
  investigations: string[];
  treatment: string[];
  key_points: string[];
  mnemonic: string;
};

type GeneratedSbaQuestion = {
  question_type: 'sba';
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  course: string;
  subject: string;
  topic: string;
  lesson: string;
  category: 'past_paper' | 'mock';
  difficulty: 'easy' | 'medium' | 'hard';
};

type GeneratedTrueFalseQuestion = {
  question_type: 'true_false';
  question_text: string;
  statements: Array<{ text: string; answer: boolean }>;
  explanation: string;
  course: string;
  subject: string;
  topic: string;
  lesson: string;
  category: 'past_paper' | 'mock';
  difficulty: 'easy' | 'medium' | 'hard';
};

type AiResponsePayload = {
  items: Array<GeneratedSbaQuestion | GeneratedTrueFalseQuestion>;
};

type BeautifiedLessonPayload = {
  suggestedTitle: string;
  beautifiedContent: string;
  shortSummary: string;
};

type RuntimeAiProviderConfig = {
  id: number | null;
  providerKey: AiProviderKey;
  providerLabel: string;
  apiKey: string;
  apiCode: string;
  baseUrl: string;
  model: string;
  source: 'settings' | 'env';
};

type AiProviderConfigRow = RowDataPacket & {
  id: number;
  provider_key: string;
  provider_label: string;
  api_key_encrypted: string | null;
  api_code_encrypted: string | null;
  base_url: string | null;
  model: string | null;
};
type QuizGeneratorEngineKey = 'gemini' | 'openai';

@Injectable()
export class AiService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(DATABASE_CONNECTION) private readonly db: Pool
  ) {}

  normalizeQuizEngineKey(value: string | undefined): QuizGeneratorEngineKey {
    return value === 'openai' ? 'openai' : 'gemini';
  }

  async generateQuiz(dto: GenerateAiQuizDto, engineKeyRaw?: string) {
    const prompt = this.buildPrompt(dto);
    const provider = await this.resolveRuntimeProviderForQuizEngine(this.normalizeQuizEngineKey(engineKeyRaw));
    const candidateText = await this.runJsonPrompt(prompt, provider);

    if (!candidateText) {
      throw new BadGatewayException(`${AI_PROVIDER_LABELS[provider.providerKey]} returned an empty response`);
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

  async beautifyLesson(dto: BeautifyLessonDto) {
    if (!dto.lessonContent?.trim()) {
      throw new BadRequestException('Lesson content is required before beautifying notes');
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

  async generateWhyIncorrect(dto: GenerateWhyIncorrectDto) {
    if (!dto.questionText?.trim()) {
      throw new BadRequestException('Question text is required');
    }

    const provider = await this.resolveRuntimeProvider();
    const prompt = this.buildWhyIncorrectPrompt(dto);
    const candidateText = await this.runJsonPrompt(prompt, provider);
    const parsed = this.parseJson(candidateText, provider.providerKey) as any;
    const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];

    const correctLabel = String(dto.correctAnswerLabel || '').trim().toUpperCase();
    const allowedWrongLabels = new Set(
      (dto.options || [])
        .filter((option) => String(option.optionLabel || '').trim().toUpperCase() !== correctLabel)
        .filter((option) => !String(option.whyIncorrect || '').trim())
        .map((option) => String(option.optionLabel || '').trim().toUpperCase())
    );

    return {
      ok: true,
      source: provider.providerKey,
      generatedAt: new Date().toISOString(),
      items: items
        .map((item: any) => ({
          optionLabel: this.normalizeString(item?.option_label || item?.optionLabel || item?.label).toUpperCase(),
          whyIncorrect: this.normalizeString(item?.why_incorrect || item?.whyIncorrect || item?.reason),
        }))
        .filter((item: { optionLabel: string; whyIncorrect: string }) => allowedWrongLabels.has(item.optionLabel) && item.whyIncorrect),
    };
  }

  async generateExplanation(dto: GenerateExplanationDto) {
    if (!dto.questionText?.trim()) {
      throw new BadRequestException('Question text is required');
    }

    const provider = await this.resolveRuntimeProvider();
    const candidateText = await this.runJsonPrompt(this.buildExplanationPrompt(dto), provider);
    const parsed = this.parseJson(candidateText, provider.providerKey) as any;
    const explanation = this.normalizeString(parsed?.explanation);

    if (!explanation) {
      throw new BadGatewayException(`${AI_PROVIDER_LABELS[provider.providerKey]} returned an empty explanation`);
    }

    return {
      ok: true,
      source: provider.providerKey,
      generatedAt: new Date().toISOString(),
      explanation,
    };
  }

  async generateTheoryCardFromQuestion(dto: GenerateExplanationDto & { explanation?: string }) {
    if (!dto.questionText?.trim()) {
      throw new BadRequestException('Question text is required');
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

  async generateTheoryRecap(input: TheoryRecapInput): Promise<TheoryRecapPayload> {
    const provider = await this.resolveRuntimeProvider();
    const prompt = this.buildTheoryRecapPrompt(input);
    const candidateText = await this.runJsonPrompt(prompt, provider);

    if (!candidateText) {
      throw new BadGatewayException(`${AI_PROVIDER_LABELS[provider.providerKey]} returned an empty response`);
    }

    const parsed = this.parseJson(candidateText, provider.providerKey) as any;

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

  private buildTheoryRecapPrompt(input: TheoryRecapInput): string {
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

  private buildWhyIncorrectPrompt(input: GenerateWhyIncorrectDto): string {
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

  private buildExplanationPrompt(input: GenerateExplanationDto): string {
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

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => this.normalizeString(item)).filter(Boolean);
  }

  private buildPrompt(dto: GenerateAiQuizDto) {
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

    const schema =
      dto.questionType === 'sba'
        ? `Return strict JSON only with this shape:
{
  "items": [
    {
      "question_type": "sba",
      "question_text": "string",
      "options": ["string", "string", "string", "string", "string"],
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
        { "text": "string", "answer": true },
        { "text": "string", "answer": false },
        { "text": "string", "answer": true },
        { "text": "string", "answer": false },
        { "text": "string", "answer": true }
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
      'Every question must include a concise explanation.',
      'Preserve the requested hierarchy values in every item. If any field is blank, return an empty string for it.',
      `Automatic LMS prompt context: ${automaticMedicalPrompt}`,
      hierarchyLines.length > 0 ? hierarchyLines.join('\n') : 'No hierarchy values were selected.',
      dto.instruction?.trim() ? `Additional free-text instruction from admin: ${dto.instruction.trim()}` : '',
      schema,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildBeautifyLessonPrompt(dto: BeautifyLessonDto) {
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

  private parseStructuredPayload(candidateText: string, providerKey: AiProviderKey): AiResponsePayload {
    const cleaned = this.cleanJsonCandidate(candidateText);

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new BadGatewayException(`${AI_PROVIDER_LABELS[providerKey]} returned malformed JSON`);
    }

    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new BadGatewayException(`${AI_PROVIDER_LABELS[providerKey]} response did not include any quiz items`);
    }

    return parsed;
  }

  private parseBeautifiedLessonPayload(candidateText: string, providerKey: AiProviderKey): BeautifiedLessonPayload {
    const parsed = this.parseJson(candidateText, providerKey);

    if (!parsed || typeof parsed !== 'object') {
      throw new BadGatewayException(`${AI_PROVIDER_LABELS[providerKey]} returned malformed lesson JSON`);
    }

    const beautifiedContent = this.normalizeString((parsed as any).beautifiedContent);
    if (!beautifiedContent) {
      throw new BadGatewayException(`${AI_PROVIDER_LABELS[providerKey]} did not return beautified lesson content`);
    }

    return {
      suggestedTitle: this.normalizeString((parsed as any).suggestedTitle),
      shortSummary: this.normalizeString((parsed as any).shortSummary),
      beautifiedContent,
    };
  }

  private parseJson(candidateText: string, providerKey: AiProviderKey) {
    try {
      return JSON.parse(this.cleanJsonCandidate(candidateText));
    } catch {
      throw new BadGatewayException(`${AI_PROVIDER_LABELS[providerKey]} returned malformed JSON`);
    }
  }

  private cleanJsonCandidate(candidateText: string) {
    return candidateText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  private async runJsonPrompt(prompt: string, provider: RuntimeAiProviderConfig) {
    if (!provider.apiKey) {
      throw new InternalServerErrorException(
        `${provider.providerLabel} is selected as the active AI provider, but it has no API key saved in admin settings.`
      );
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
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof InternalServerErrorException) {
        throw error;
      }
      const message = this.extractErrorMessage(error);
      const normalized = message.toLowerCase();
      const isTimeout = normalized.includes('timed out') || normalized.includes('abort') || normalized.includes('timeout');
      const isSocket =
        normalized.includes('socket') ||
        normalized.includes('fetch failed') ||
        normalized.includes('econnreset') ||
        normalized.includes('und_err_socket') ||
        normalized.includes('terminated');
      if (isTimeout) {
        throw new BadGatewayException(`${provider.providerLabel} did not respond within ${AI_REQUEST_TIMEOUT_MS / 1000} seconds. Try again or switch to a faster model.`);
      }
      if (isSocket) {
        throw new BadGatewayException(`${provider.providerLabel} connection was interrupted. Check your internet connection and try again.`);
      }
      throw new BadGatewayException(this.formatProviderError(provider.providerKey, error, provider.model));
    }
  }

  private async sendOpenRouterPrompt(provider: RuntimeAiProviderConfig, prompt: string) {
    const siteUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5174';
    const siteName = 'ERPM LMS';
    const response = await fetchWithRetry(normalizeAiProviderBaseUrl('openrouter', provider.baseUrl), {
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
      throw new BadGatewayException(this.formatProviderError('openrouter', this.extractOpenRouterError(rawPayload), provider.model));
    }

    const text = this.extractChatCompletionText(rawPayload);
    if (!text) {
      throw new BadGatewayException('OpenRouter returned an empty completion');
    }

    return text.trim();
  }

  private async sendOpenAiPrompt(provider: RuntimeAiProviderConfig, prompt: string) {
    let text = '';
    try {
      text = await this.sendOpenAiJsonRequest(provider, prompt, true);
    } catch (error) {
      const message = this.extractErrorMessage(error);
      if (!this.isUnsupportedOpenAiJsonModeError(message)) {
        throw error;
      }
      text = await this.sendOpenAiJsonRequest(provider, prompt, false);
    }
    if (!text) {
      throw new BadGatewayException('OpenAI returned an empty completion');
    }

    return text.trim();
  }

  private async sendClaudePrompt(provider: RuntimeAiProviderConfig, prompt: string) {
    const response = await fetchWithRetry(normalizeAiProviderBaseUrl('claude', provider.baseUrl), {
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
      throw new BadGatewayException(this.formatProviderError('claude', this.extractGenericApiError(rawPayload), provider.model));
    }

    const text = this.extractClaudeText(rawPayload);
    if (!text) {
      throw new BadGatewayException('Claude returned an empty completion');
    }

    return text.trim();
  }

  private async sendGeminiPrompt(provider: RuntimeAiProviderConfig, prompt: string) {
    const client = new GoogleGenerativeAI(provider.apiKey);
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
          throw new BadGatewayException('Gemini returned an empty completion');
        }

        return text.trim();
      } catch (error) {
        if (error instanceof BadGatewayException) {
          throw error;
        }

        const message = this.extractErrorMessage(error);
        const retryable =
          message.toLowerCase().includes('socket') ||
          message.toLowerCase().includes('fetch failed') ||
          message.toLowerCase().includes('econnreset') ||
          message.toLowerCase().includes('und_err_socket') ||
          message.toLowerCase().includes('terminated');

        if (!retryable || attempt === 3) {
          throw new BadGatewayException(this.formatProviderError('gemini', message, provider.model));
        }

        await new Promise((resolve) => setTimeout(resolve, 1500 * 2 ** attempt + Math.floor(Math.random() * 300)));
      }
    }

    throw new BadGatewayException('Gemini request failed after retries');
  }

  private async resolveRuntimeProvider(): Promise<RuntimeAiProviderConfig> {
    const configuredProvider = await this.getActiveAiProviderFromSettings();
    if (configuredProvider) {
      return configuredProvider;
    }

    const envApiKey = String(this.configService.get<string>('OPENROUTER_API_KEY') || '').trim();
    if (envApiKey) {
      return {
        id: null,
        providerKey: 'openrouter',
        providerLabel: 'OpenRouter (.env fallback)',
        apiKey: envApiKey,
        apiCode: '',
        baseUrl: getDefaultBaseUrlForProvider('openrouter'),
        model: String(this.configService.get<string>('OPENROUTER_MODEL') || getDefaultModelForProvider('openrouter')).trim(),
        source: 'env',
      };
    }

    throw new InternalServerErrorException(
      'No active AI provider is configured. Add and activate a provider in admin settings, or set OPENROUTER_API_KEY in backend/.env as a temporary fallback.'
    );
  }

  private async resolveRuntimeProviderForQuizEngine(engineKey: QuizGeneratorEngineKey): Promise<RuntimeAiProviderConfig> {
    const configuredProvider = await this.getProviderByKeyFromSettings(engineKey);
    if (configuredProvider) {
      return configuredProvider;
    }

    if (engineKey === 'openai') {
      const envApiKey = String(this.configService.get<string>('OPENAI_API_KEY') || '').trim();
      if (envApiKey) {
        return {
          id: null,
          providerKey: 'openai',
          providerLabel: 'ChatGPT / OpenAI (.env fallback)',
          apiKey: envApiKey,
          apiCode: '',
          baseUrl: getDefaultBaseUrlForProvider('openai'),
          model: String(this.configService.get<string>('OPENAI_MODEL') || getDefaultModelForProvider('openai')).trim(),
          source: 'env',
        };
      }
      throw new InternalServerErrorException(
        'No OpenAI provider is configured for the ChatGPT quiz generator. Save an OpenAI key in admin settings or set OPENAI_API_KEY in backend/.env.'
      );
    }

    const envGeminiKey = String(this.configService.get<string>('GEMINI_API_KEY') || '').trim();
    if (envGeminiKey) {
      return {
        id: null,
        providerKey: 'gemini',
        providerLabel: 'Gemini (.env fallback)',
        apiKey: envGeminiKey,
        apiCode: '',
        baseUrl: '',
        model: String(this.configService.get<string>('GEMINI_MODEL') || getDefaultModelForProvider('gemini')).trim(),
        source: 'env',
      };
    }

    throw new InternalServerErrorException(
      'No Gemini provider is configured for the Gemini quiz generator. Save a Gemini key in admin settings or set GEMINI_API_KEY in backend/.env.'
    );
  }

  private async getActiveAiProviderFromSettings(): Promise<RuntimeAiProviderConfig | null> {
    const [rows] = await this.db.execute<AiProviderConfigRow[]>(
      `
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
      `
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const normalizedKey = String(row.provider_key || '').trim().toLowerCase();
    if (!isAiProviderKey(normalizedKey)) {
      throw new InternalServerErrorException('The active AI provider in settings is invalid');
    }

    return {
      id: row.id,
      providerKey: normalizedKey,
      providerLabel: String(row.provider_label || '').trim() || AI_PROVIDER_LABELS[normalizedKey],
      apiKey: this.safeDecryptSecret(String(row.api_key_encrypted || '')),
      apiCode: this.safeDecryptSecret(String(row.api_code_encrypted || '')),
      baseUrl: normalizeAiProviderBaseUrl(normalizedKey, row.base_url),
      model: String(row.model || '').trim() || getDefaultModelForProvider(normalizedKey),
      source: 'settings',
    };
  }

  private async getProviderByKeyFromSettings(providerKey: QuizGeneratorEngineKey): Promise<RuntimeAiProviderConfig | null> {
    const [rows] = await this.db.execute<AiProviderConfigRow[]>(
      `
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
      `,
      [providerKey]
    );

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      providerKey,
      providerLabel: String(row.provider_label || '').trim() || AI_PROVIDER_LABELS[providerKey],
      apiKey: this.safeDecryptSecret(String(row.api_key_encrypted || '')),
      apiCode: this.safeDecryptSecret(String(row.api_code_encrypted || '')),
      baseUrl: normalizeAiProviderBaseUrl(providerKey, row.base_url),
      model: String(row.model || '').trim() || getDefaultModelForProvider(providerKey),
      source: 'settings',
    };
  }

  private async sendOpenAiJsonRequest(provider: RuntimeAiProviderConfig, prompt: string, useJsonMode: boolean) {
    const response = await fetchWithRetry(normalizeAiProviderBaseUrl('openai', provider.baseUrl), {
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
      throw new BadGatewayException(this.formatProviderError('openai', this.extractGenericApiError(rawPayload), provider.model));
    }

    return this.extractChatCompletionText(rawPayload).trim();
  }

  private isUnsupportedOpenAiJsonModeError(message: string) {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('response_format')
      && (normalized.includes('not supported') || normalized.includes('invalid parameter'));
  }

  private safeDecryptSecret(value: string) {
    try {
      return decryptSecret(value, this.getEncryptionSecret());
    } catch {
      return '';
    }
  }

  private getEncryptionSecret() {
    const configured = String(this.configService.get<string>('SETTINGS_ENCRYPTION_KEY') || '').trim();
    const nodeEnv = String(this.configService.get<string>('NODE_ENV') || 'development').trim();
    if (!configured && nodeEnv === 'production') {
      throw new BadRequestException('SETTINGS_ENCRYPTION_KEY must be configured before using saved AI provider secrets');
    }
    return configured || 'lms-dev-settings-key-change-me';
  }

  private extractChatCompletionText(payload: any) {
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

  private extractClaudeText(payload: any) {
    const content = payload?.content;
    if (!Array.isArray(content)) {
      return '';
    }

    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }

  private extractOpenRouterError(payload: any) {
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

  private extractGenericApiError(payload: any) {
    const candidates = [payload?.error?.message, payload?.message, payload?.error?.type, payload?.error];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return 'Unknown provider error';
  }

  private normalizeItem(item: any, dto: GenerateAiQuizDto, index: number) {
    const base = {
      question_type: dto.questionType,
      course: this.normalizeString(item.course, dto.course),
      subject: this.normalizeString(item.subject, dto.subject),
      topic: this.normalizeString(item.topic, dto.topic),
      lesson: this.normalizeString(item.lesson, dto.lesson),
      category: dto.category,
      difficulty: dto.difficulty,
      explanation: this.normalizeString(item.explanation),
      question_text: this.normalizeString(item.question_text),
    };

    if (!base.question_text) {
      throw new BadGatewayException(`Generated item ${index + 1} is missing question_text`);
    }

    if (dto.questionType === 'sba') {
      const options = Array.isArray(item.options)
        ? item.options.map((option: unknown) => this.normalizeString(option)).filter(Boolean)
        : [];

      if (options.length !== 5) {
        throw new BadGatewayException(`Generated SBA item ${index + 1} must contain exactly 5 options`);
      }

      const correctAnswer = this.normalizeString(item.correct_answer);
      if (!correctAnswer) {
        throw new BadGatewayException(`Generated SBA item ${index + 1} is missing correct_answer`);
      }

      return {
        ...base,
        question_type: 'sba' as const,
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
      .map((statement: any) => ({
        text: this.normalizeString(statement?.text ?? statement?.statement ?? statement?.option_text ?? statement?.optionText),
        answer: this.normalizeBooleanValue(
          statement?.answer ?? statement?.isTrue ?? statement?.is_true ?? statement?.isCorrect ?? statement?.is_correct
        ),
      }))
      .filter((statement: { text: string }) => statement.text);

    if (statements.length !== 5) {
      throw new BadGatewayException(`Generated True/False item ${index + 1} must contain exactly 5 statements`);
    }

    const invalidStatement = statements.find((statement: { text: string; answer: boolean | null }) => statement.answer === null);
    if (invalidStatement) {
      throw new BadGatewayException(`Generated True/False item ${index + 1} contains a statement with an invalid true/false value`);
    }

    return {
      ...base,
      question_type: 'true_false' as const,
      statements: statements as Array<{ text: string; answer: boolean }>,
    };
  }

  private normalizeString(value: unknown, fallback = '') {
    return typeof value === 'string' ? value.trim() : String(fallback || '').trim();
  }

  private normalizeBooleanValue(value: unknown): boolean | null {
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

  private formatProviderError(providerKey: AiProviderKey, error: unknown, modelName = '') {
    const rawMessage = this.extractErrorMessage(error);
    const normalized = rawMessage.toLowerCase();
    const providerLabel = AI_PROVIDER_LABELS[providerKey];

    if (
      normalized.includes('fetch failed') ||
      normalized.includes('socket connection was closed') ||
      normalized.includes('connectionclosed') ||
      normalized.includes('econnreset')
    ) {
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

  private extractErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unknown error';
  }
}
