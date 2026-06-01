import { ConfigService } from '@nestjs/config';
import { Pool } from 'mysql2/promise';
import { BeautifyLessonDto } from './dto/beautify-lesson.dto';
import { GenerateAiQuizDto } from './dto/generate-ai-quiz.dto';
import { GenerateWhyIncorrectDto } from './dto/generate-why-incorrect.dto';
import { GenerateExplanationDto } from './dto/generate-explanation.dto';
export type TheoryRecapInput = {
    questionText: string;
    questionType: 'sba' | 'true_false';
    options: Array<{
        optionLabel: string;
        optionText: string;
        isCorrect: number;
    }>;
    explanation: string;
    course: string;
    subject: string;
    topic: string;
    lesson: string;
    category: string;
};
export type TheoryRecapPayload = {
    concept_name: string;
    hierarchy: {
        course: string;
        subject: string;
        topic: string;
        lesson: string;
    };
    etiology: string[];
    pathophysiology: string[];
    clinical_features: string[];
    investigations: string[];
    treatment: string[];
    key_points: string[];
    mnemonic: string;
};
type QuizGeneratorEngineKey = 'gemini' | 'openai';
export declare class AiService {
    private readonly configService;
    private readonly db;
    constructor(configService: ConfigService, db: Pool);
    normalizeQuizEngineKey(value: string | undefined): QuizGeneratorEngineKey;
    generateQuiz(dto: GenerateAiQuizDto, engineKeyRaw?: string): Promise<{
        ok: boolean;
        experimental: boolean;
        source: "openai" | "gemini" | "claude" | "openrouter";
        generatedAt: string;
        provider: {
            id: number | null;
            key: "openai" | "gemini" | "claude" | "openrouter";
            label: string;
            model: string;
            source: "settings" | "env";
        };
        settings: {
            course: string;
            subject: string;
            topic: string;
            lesson: string;
            category: "past_paper" | "mock" | "ai";
            questionType: "sba" | "true_false";
            difficulty: "easy" | "medium" | "hard";
            numberOfQuestions: number;
            instruction: string;
        };
        items: ({
            question_type: "sba";
            options: any;
            correct_answer: string;
            course: string;
            subject: string;
            topic: string;
            lesson: string;
            category: "past_paper" | "mock" | "ai";
            difficulty: "easy" | "medium" | "hard";
            explanation: string;
            question_text: string;
        } | {
            question_type: "true_false";
            statements: Array<{
                text: string;
                answer: boolean;
            }>;
            course: string;
            subject: string;
            topic: string;
            lesson: string;
            category: "past_paper" | "mock" | "ai";
            difficulty: "easy" | "medium" | "hard";
            explanation: string;
            question_text: string;
        })[];
    }>;
    beautifyLesson(dto: BeautifyLessonDto): Promise<{
        ok: boolean;
        experimental: boolean;
        source: "openai" | "gemini" | "claude" | "openrouter";
        generatedAt: string;
        provider: {
            id: number | null;
            key: "openai" | "gemini" | "claude" | "openrouter";
            label: string;
            model: string;
            source: "settings" | "env";
        };
        suggestedTitle: string;
        beautifiedContent: string;
        shortSummary: string;
    }>;
    generateWhyIncorrect(dto: GenerateWhyIncorrectDto): Promise<{
        ok: boolean;
        source: "openai" | "gemini" | "claude" | "openrouter";
        generatedAt: string;
        items: any;
    }>;
    generateExplanation(dto: GenerateExplanationDto): Promise<{
        ok: boolean;
        source: "openai" | "gemini" | "claude" | "openrouter";
        generatedAt: string;
        explanation: string;
    }>;
    generateTheoryCardFromQuestion(dto: GenerateExplanationDto & {
        explanation?: string;
    }): Promise<{
        ok: boolean;
        conceptName: string;
        hierarchy: {
            course: string;
            subject: string;
            topic: string;
            lesson: string;
        };
        etiology: string[];
        pathophysiology: string[];
        clinicalFeatures: string[];
        investigations: string[];
        treatment: string[];
        keyPoints: string[];
        mnemonic: string;
        reviewedStatus: string;
        generatedAt: string;
    }>;
    generateTheoryRecap(input: TheoryRecapInput): Promise<TheoryRecapPayload>;
    private buildTheoryRecapPrompt;
    private buildWhyIncorrectPrompt;
    private buildExplanationPrompt;
    private normalizeStringArray;
    private buildPrompt;
    private buildBeautifyLessonPrompt;
    private parseStructuredPayload;
    private parseBeautifiedLessonPayload;
    private parseJson;
    private cleanJsonCandidate;
    private runJsonPrompt;
    private sendOpenRouterPrompt;
    private sendOpenAiPrompt;
    private sendClaudePrompt;
    private sendGeminiPrompt;
    private resolveRuntimeProvider;
    private resolveRuntimeProviderForQuizEngine;
    private getActiveAiProviderFromSettings;
    private getProviderByKeyFromSettings;
    private sendOpenAiJsonRequest;
    private isUnsupportedOpenAiJsonModeError;
    private safeDecryptSecret;
    private getEncryptionSecret;
    private extractChatCompletionText;
    private extractClaudeText;
    private extractOpenRouterError;
    private extractGenericApiError;
    private normalizeItem;
    private normalizeString;
    private normalizeCorrectOptionLabel;
    private normalizeBooleanValue;
    private formatProviderError;
    private extractErrorMessage;
}
export {};
