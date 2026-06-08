import Foundation
import Observation

@Observable
@MainActor
final class AuthSession {
    var user: User?
    var isAuthenticated = false
    var isHydrating = false
    var sessionExpired = false

    private(set) var token: String? {
        didSet {
            APIClient.shared.authToken = token
        }
    }

    static let shared = AuthSession()

    private init() {
        // Pre-set hydrating so the splash screen shows immediately on launch
        // when a token exists, preventing a flash of the login screen.
        isHydrating = KeychainStore.load(.sessionToken) != nil
        APIClient.shared.onUnauthorized = { [weak self] in
            Task { @MainActor in
                self?.forceSignOut()
            }
        }
    }

    func setAuthenticated(token: String, user: User) {
        KeychainStore.save(token, for: .sessionToken)
        self.token = token
        self.user = user
        self.isAuthenticated = true
        self.sessionExpired = false
    }

    func updateCurrentUser(_ user: User) {
        self.user = user
        self.isAuthenticated = token?.isEmpty == false
    }

    func signOut() {
        KeychainStore.delete(.sessionToken)
        token = nil
        user = nil
        isAuthenticated = false
        sessionExpired = false
    }

    func forceSignOut() {
        signOut()
        sessionExpired = true
    }

    // Called once at app launch
    func restoreSession() async {
        defer { isHydrating = false }
        guard let savedToken = KeychainStore.load(.sessionToken) else { return }
        token = savedToken
        do {
            let response: CurrentUserResponse = try await APIClient.shared.request(.me)
            if let user = response.user {
                self.user = user
                self.isAuthenticated = true
            } else {
                signOut()
            }
        } catch let error as APIError where error.isUnauthorized {
            signOut()
        } catch {
            // Network failure — keep token but don't mark authenticated
            // so we can retry on next launch
            token = nil
        }
    }
}
