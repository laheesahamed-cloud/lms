import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleCodeLoginDto } from './dto/google-code-login.dto';
import { AppleLoginDto } from './dto/apple-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { ResendEmailOtpDto } from './dto/resend-email-otp.dto';
export declare class AuthController {
    private readonly authService;
    private readonly configService;
    private readonly moduleRef;
    private readonly logger;
    constructor(authService: AuthService, configService: ConfigService, moduleRef: ModuleRef);
    private withAppStart;
    login(loginDto: LoginDto, nativeHeader: string | undefined, appClient: string | undefined, lastNoticeId: string | undefined, request: any, response: any): Promise<any>;
    register(registerDto: RegisterDto, nativeHeader: string | undefined, request: any, response: any): Promise<any>;
    verifyEmailOtp(verifyEmailOtpDto: VerifyEmailOtpDto, nativeHeader: string | undefined, appClient: string | undefined, lastNoticeId: string | undefined, request: any, response: any): Promise<any>;
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
    googleLogin(googleLoginDto: GoogleLoginDto, nativeHeader: string | undefined, appClient: string | undefined, lastNoticeId: string | undefined, request: any, response: any): Promise<any>;
    googleCodeLogin(googleCodeLoginDto: GoogleCodeLoginDto, nativeHeader: string | undefined, requestedWith: string | undefined, origin: string | undefined, request: any, response: any): Promise<any>;
    appleLogin(appleLoginDto: AppleLoginDto, nativeHeader: string | undefined, appClient: string | undefined, lastNoticeId: string | undefined, request: any, response: any): Promise<any>;
    appleWebCallbackPost(body: any, request: any, response: any): Promise<void>;
    appleWebCallbackGet(query: any, request: any, response: any): Promise<void>;
    private handleAppleWebCallback;
    private redirectTo;
    private appendParam;
    private readCookie;
    me(authorization?: string, cookie?: string): Promise<{
        ok: boolean;
        user: {
            id: number;
            fullName: string;
            email: string;
            role: "student" | "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff";
            permissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[];
            status: "active" | "inactive";
            avatarKey: string;
            needsProfileSetup: boolean;
            hasActiveSubscription: any;
            subscriptionStatus: any;
            currentPlanName: any;
            featureAccess: any;
            accessUntil: string | null;
            accessRenews: boolean;
        };
        redirectPath: string;
    }>;
    renewAccessToken(authorization?: string, cookie?: string): Promise<{
        user: {
            id: number;
            fullName: string;
            email: string;
            role: "student" | "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff";
            permissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[];
            status: "active" | "inactive";
            avatarKey: string;
            needsProfileSetup: boolean;
            hasActiveSubscription: any;
            subscriptionStatus: any;
            currentPlanName: any;
            featureAccess: any;
            accessUntil: string | null;
            accessRenews: boolean;
        };
        accessToken: string;
        accessExpiresIn: number;
        ok: boolean;
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
    updateProfile(authorization: string | undefined, updateProfileDto: UpdateProfileDto, appClient?: string): Promise<{
        ok: boolean;
        user: {
            id: number;
            fullName: string;
            email: string;
            role: "student" | "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff";
            permissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[];
            status: "active" | "inactive";
            avatarKey: string;
            needsProfileSetup: boolean;
            hasActiveSubscription: any;
            subscriptionStatus: any;
            currentPlanName: any;
            featureAccess: any;
            accessUntil: string | null;
            accessRenews: boolean;
        };
    } | {
        ok: boolean;
        user: {
            fullName: string;
            avatarKey: string;
            needsProfileSetup: boolean;
        };
    }>;
    completeProfileSetup(authorization: string | undefined): Promise<{
        ok: boolean;
        user: {
            id: number;
            fullName: string;
            email: string;
            role: "student" | "admin" | "content_editor" | "reviewer" | "tutor" | "finance" | "support" | "staff";
            permissions: ("admin.access" | "content.manage" | "content.review" | "students.manage" | "questions.manage" | "quizzes.manage" | "subscriptions.manage" | "plans.manage" | "settings.manage" | "ai.manage" | "notifications.manage" | "reports.view")[];
            status: "active" | "inactive";
            avatarKey: string;
            needsProfileSetup: boolean;
            hasActiveSubscription: any;
            subscriptionStatus: any;
            currentPlanName: any;
            featureAccess: any;
            accessUntil: string | null;
            accessRenews: boolean;
        };
    }>;
    changePassword(authorization: string | undefined, changePasswordDto: ChangePasswordDto): Promise<{
        ok: boolean;
        signedOut: boolean;
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
