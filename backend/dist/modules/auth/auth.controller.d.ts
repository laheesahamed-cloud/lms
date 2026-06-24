import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleCodeLoginDto } from './dto/google-code-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { ResendEmailOtpDto } from './dto/resend-email-otp.dto';
export declare class AuthController {
    private readonly authService;
    private readonly configService;
    constructor(authService: AuthService, configService: ConfigService);
    login(loginDto: LoginDto, nativeHeader: string | undefined, request: any, response: any): Promise<any>;
    register(registerDto: RegisterDto, nativeHeader: string | undefined, request: any, response: any): Promise<any>;
    verifyEmailOtp(verifyEmailOtpDto: VerifyEmailOtpDto, nativeHeader: string | undefined, request: any, response: any): Promise<any>;
    resendEmailOtp(resendEmailOtpDto: ResendEmailOtpDto): Promise<{
        ok: boolean;
        expiresInMinutes: number;
        message: string;
    } | {
        retryAfterSeconds: number;
        ok: boolean;
        expiresInMinutes: number;
        message: string;
    } | {
        devCode?: string | undefined;
        emailSent: boolean;
        ok: boolean;
        expiresInMinutes: number;
        message: string;
    }>;
    googleLogin(googleLoginDto: GoogleLoginDto, nativeHeader: string | undefined, request: any, response: any): Promise<{
        ok: boolean;
        sessionTtlDays: number;
        redirectPath: string;
        user: {
            id: number;
            fullName: string;
            email: string;
            role: "student" | "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support";
            permissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[];
            status: "active" | "inactive";
            avatarKey: string;
            hasActiveSubscription: boolean;
            subscriptionStatus: string;
            currentPlanName: string;
            featureAccess: {
                aiNotes: boolean;
                advancedInsights: boolean;
                notesAccess: boolean;
                aiTools: boolean;
                analytics: boolean;
                lessonsAccess: boolean;
                practiceMode: boolean;
                examMode: boolean;
                aiQuizGenerator: boolean;
                resultsTracking: boolean;
                notesCanvasStudyMode: boolean;
                performanceAnalytics: boolean;
                weakAreaAnalysis: boolean;
                progressTrackingBasic: boolean;
                progressTrackingAdvanced: boolean;
                reportQuestion: boolean;
                pastPaperAccess: boolean;
                mockPaperAccess: boolean;
                featureKeys: string[];
            } | {
                aiNotes: boolean;
                advancedInsights: boolean;
                practiceMode: boolean;
                examMode: boolean;
                aiQuizGenerator: boolean;
                resultsTracking: boolean;
                notesCanvasStudyMode: boolean;
                performanceAnalytics: boolean;
                weakAreaAnalysis: boolean;
                progressTrackingBasic: boolean;
                progressTrackingAdvanced: boolean;
                reportQuestion: boolean;
                pastPaperAccess: boolean;
                mockPaperAccess: boolean;
                featureKeys: never[];
            };
        };
    }>;
    googleCodeLogin(googleCodeLoginDto: GoogleCodeLoginDto, nativeHeader: string | undefined, requestedWith: string | undefined, origin: string | undefined, request: any, response: any): Promise<any>;
    me(authorization?: string, cookie?: string): Promise<{
        ok: boolean;
        user: {
            id: number;
            fullName: string;
            email: string;
            role: "student" | "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support";
            permissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[];
            status: "active" | "inactive";
            avatarKey: string;
            hasActiveSubscription: boolean;
            subscriptionStatus: string;
            currentPlanName: string;
            featureAccess: {
                aiNotes: boolean;
                advancedInsights: boolean;
                notesAccess: boolean;
                aiTools: boolean;
                analytics: boolean;
                lessonsAccess: boolean;
                practiceMode: boolean;
                examMode: boolean;
                aiQuizGenerator: boolean;
                resultsTracking: boolean;
                notesCanvasStudyMode: boolean;
                performanceAnalytics: boolean;
                weakAreaAnalysis: boolean;
                progressTrackingBasic: boolean;
                progressTrackingAdvanced: boolean;
                reportQuestion: boolean;
                pastPaperAccess: boolean;
                mockPaperAccess: boolean;
                featureKeys: string[];
            } | {
                aiNotes: boolean;
                advancedInsights: boolean;
                practiceMode: boolean;
                examMode: boolean;
                aiQuizGenerator: boolean;
                resultsTracking: boolean;
                notesCanvasStudyMode: boolean;
                performanceAnalytics: boolean;
                weakAreaAnalysis: boolean;
                progressTrackingBasic: boolean;
                progressTrackingAdvanced: boolean;
                reportQuestion: boolean;
                pastPaperAccess: boolean;
                mockPaperAccess: boolean;
                featureKeys: never[];
            };
        };
        redirectPath: string;
    }>;
    logout(authorization: string | undefined, cookie: string | undefined, request: any, response: any): Promise<{
        ok: boolean;
    }>;
    deleteAccount(authorization: string | undefined, cookie: string | undefined, request: any, response: any): Promise<{
        ok: boolean;
        message: string;
    }>;
    requestPasswordReset(forgotPasswordDto: ForgotPasswordDto): Promise<{
        ok: boolean;
        message: string;
        emailSent?: undefined;
        resetToken?: undefined;
        resetPath?: undefined;
        expiresInMinutes?: undefined;
    } | {
        ok: boolean;
        message: string;
        emailSent: boolean;
        resetToken: string | undefined;
        resetPath: string | undefined;
        expiresInMinutes: number;
    }>;
    resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{
        ok: boolean;
        message: string;
    }>;
    updateProfile(authorization: string | undefined, updateProfileDto: UpdateProfileDto): Promise<{
        ok: boolean;
        user: {
            id: number;
            fullName: string;
            email: string;
            role: "student" | "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support";
            permissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[];
            status: "active" | "inactive";
            avatarKey: string;
            hasActiveSubscription: boolean;
            subscriptionStatus: string;
            currentPlanName: string;
            featureAccess: {
                aiNotes: boolean;
                advancedInsights: boolean;
                notesAccess: boolean;
                aiTools: boolean;
                analytics: boolean;
                lessonsAccess: boolean;
                practiceMode: boolean;
                examMode: boolean;
                aiQuizGenerator: boolean;
                resultsTracking: boolean;
                notesCanvasStudyMode: boolean;
                performanceAnalytics: boolean;
                weakAreaAnalysis: boolean;
                progressTrackingBasic: boolean;
                progressTrackingAdvanced: boolean;
                reportQuestion: boolean;
                pastPaperAccess: boolean;
                mockPaperAccess: boolean;
                featureKeys: string[];
            } | {
                aiNotes: boolean;
                advancedInsights: boolean;
                practiceMode: boolean;
                examMode: boolean;
                aiQuizGenerator: boolean;
                resultsTracking: boolean;
                notesCanvasStudyMode: boolean;
                performanceAnalytics: boolean;
                weakAreaAnalysis: boolean;
                progressTrackingBasic: boolean;
                progressTrackingAdvanced: boolean;
                reportQuestion: boolean;
                pastPaperAccess: boolean;
                mockPaperAccess: boolean;
                featureKeys: never[];
            };
        };
    }>;
    changePassword(authorization: string | undefined, changePasswordDto: ChangePasswordDto): Promise<{
        ok: boolean;
    }>;
    private setSessionCookie;
    private clearSessionCookie;
    private shouldUseSecureSessionCookie;
    private getBooleanConfig;
    private isInsecureLocalOrLanRequest;
    private isInsecureLocalOrLanUrl;
    private shouldExposeSessionToken;
    private authorizationFromCookie;
}
