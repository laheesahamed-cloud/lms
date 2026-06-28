import { AiService } from './ai.service';
import { GenerateAiQuizDto } from './dto/generate-ai-quiz.dto';
import { BeautifyLessonDto } from './dto/beautify-lesson.dto';
import { GenerateWhyIncorrectDto } from './dto/generate-why-incorrect.dto';
import { GenerateExplanationDto } from './dto/generate-explanation.dto';
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    generateQuiz(dto: GenerateAiQuizDto, engine: string, includeExplanations?: string, includeWhyIncorrect?: string): Promise<{
        ok: boolean;
        experimental: boolean;
        source: "gemini" | "openai" | "claude" | "openrouter";
        generatedAt: string;
        provider: {
            id: number | null;
            key: "gemini" | "openai" | "claude" | "openrouter";
            label: string;
            model: string;
            source: "settings" | "env";
        };
        settings: {
            course: string;
            subject: string;
            topic: string;
            lesson: string;
            category: "ai" | "past_paper" | "mock";
            questionType: "sba" | "true_false";
            difficulty: "medium" | "easy" | "hard";
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
            category: "ai" | "past_paper" | "mock";
            difficulty: "medium" | "easy" | "hard";
            explanation: string;
            question_text: string;
        } | {
            question_type: "true_false";
            statements: {
                text: string;
                answer: boolean;
            }[];
            course: string;
            subject: string;
            topic: string;
            lesson: string;
            category: "ai" | "past_paper" | "mock";
            difficulty: "medium" | "easy" | "hard";
            explanation: string;
            question_text: string;
        })[];
    }>;
    beautifyLesson(dto: BeautifyLessonDto): Promise<{
        ok: boolean;
        experimental: boolean;
        source: "gemini" | "openai" | "claude" | "openrouter";
        generatedAt: string;
        provider: {
            id: number | null;
            key: "gemini" | "openai" | "claude" | "openrouter";
            label: string;
            model: string;
            source: "settings" | "env";
        };
        suggestedTitle: string;
        beautifiedContent: string;
        shortSummary: string;
    }>;
    generateWhyIncorrect(dto: GenerateWhyIncorrectDto, questionType?: 'sba' | 'true_false'): Promise<{
        ok: boolean;
        source: "gemini" | "openai" | "claude" | "openrouter";
        generatedAt: string;
        items: any;
    }>;
    generateExplanation(dto: GenerateExplanationDto): Promise<{
        ok: boolean;
        source: "gemini" | "openai" | "claude" | "openrouter";
        generatedAt: string;
        explanation: string;
    }>;
    generateTheoryCard(dto: GenerateExplanationDto & {
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
}
