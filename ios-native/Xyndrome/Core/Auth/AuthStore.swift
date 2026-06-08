import Foundation

@MainActor
final class AuthStore {
    static let shared = AuthStore()
    private init() {}

    func login(email: String, password: String) async throws {
        let body = LoginRequest(email: email, password: password)
        let response: AuthResponse = try await APIClient.shared.request(.login, body: body)
        guard let token = response.sessionToken, let user = response.user else {
            throw APIError.serverError(200, "Login did not return a valid session.")
        }
        AuthSession.shared.setAuthenticated(token: token, user: user)
        await PushNotificationManager.shared.syncToken()
    }

    func register(fullName: String, email: String, password: String, confirmPassword: String, acceptedTerms: Bool) async throws {
        let body = RegisterRequest(
            fullName: fullName,
            email: email,
            password: password,
            confirmPassword: confirmPassword,
            acceptedTerms: acceptedTerms
        )
        let response: AuthResponse = try await APIClient.shared.request(.register, body: body)
        guard let token = response.sessionToken, let user = response.user else {
            throw APIError.serverError(200, "Registration did not return a valid session.")
        }
        AuthSession.shared.setAuthenticated(token: token, user: user)
        await PushNotificationManager.shared.syncToken()
    }

    func logout() async {
        try? await APIClient.shared.requestVoid(.logout)
        await PushNotificationManager.shared.unregisterToken()
        AuthSession.shared.signOut()
    }

    func forgotPassword(email: String) async throws {
        let body = ForgotPasswordRequest(email: email)
        let _: SimpleOkResponse = try await APIClient.shared.request(.forgotPassword, body: body)
    }

    func resetPassword(token: String, newPassword: String, confirmPassword: String) async throws {
        let body = ResetPasswordRequest(
            token: token,
            newPassword: newPassword,
            confirmPassword: confirmPassword
        )
        let _: SimpleOkResponse = try await APIClient.shared.request(.resetPassword, body: body)
    }

    func updateProfile(fullName: String?, avatarKey: String?) async throws {
        let body = UpdateProfileRequest(fullName: fullName, avatarKey: avatarKey)
        let response: AuthResponse = try await APIClient.shared.request(.updateProfile, body: body)
        if let user = response.user {
            AuthSession.shared.updateCurrentUser(user)
        }
    }

    func changePassword(currentPassword: String, newPassword: String, confirmPassword: String) async throws {
        let body = ChangePasswordRequest(
            currentPassword: currentPassword,
            newPassword: newPassword,
            confirmPassword: confirmPassword
        )
        let _: SimpleOkResponse = try await APIClient.shared.request(.changePassword, body: body)
    }
}
