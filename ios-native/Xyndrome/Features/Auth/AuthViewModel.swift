import Foundation
import Observation

@Observable
@MainActor
final class AuthViewModel {
    nonisolated init() {}
    var email = ""
    var password = ""
    var confirmPassword = ""
    var fullName = ""
    var acceptedTerms = false
    var resetToken = ""
    var newPassword = ""
    var confirmNewPassword = ""

    var isLoading = false
    var errorMessage: String?
    var successMessage: String?

    func login() async -> Bool {
        guard validate(email: email, password: password) else { return false }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await AuthStore.shared.login(email: email, password: password)
            return true
        } catch let error as APIError {
            errorMessage = error.errorDescription
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func register() async -> Bool {
        guard !fullName.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please enter your full name."
            return false
        }
        guard validate(email: email, password: password) else { return false }
        guard password == confirmPassword else {
            errorMessage = "Passwords do not match."
            return false
        }
        guard acceptedTerms else {
            errorMessage = "Please accept the terms to create your account."
            return false
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await AuthStore.shared.register(
                fullName: fullName,
                email: email,
                password: password,
                confirmPassword: confirmPassword,
                acceptedTerms: acceptedTerms
            )
            return true
        } catch let error as APIError {
            errorMessage = error.errorDescription
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func forgotPassword() async -> Bool {
        guard !email.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please enter your email address."
            return false
        }
        isLoading = true
        errorMessage = nil
        successMessage = nil
        defer { isLoading = false }
        do {
            try await AuthStore.shared.forgotPassword(email: email)
            successMessage = "Check your email for a password reset link."
            return true
        } catch let error as APIError {
            errorMessage = error.errorDescription
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func resetPassword() async -> Bool {
        guard !newPassword.isEmpty else {
            errorMessage = "Please enter a new password."
            return false
        }
        guard newPassword == confirmNewPassword else {
            errorMessage = "Passwords do not match."
            return false
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await AuthStore.shared.resetPassword(
                token: resetToken,
                newPassword: newPassword,
                confirmPassword: confirmNewPassword
            )
            successMessage = "Password reset successfully. Please sign in."
            return true
        } catch let error as APIError {
            errorMessage = error.errorDescription
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func validate(email: String, password: String) -> Bool {
        guard !email.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please enter your email address."
            return false
        }
        guard !password.isEmpty else {
            errorMessage = "Please enter your password."
            return false
        }
        return true
    }
}
