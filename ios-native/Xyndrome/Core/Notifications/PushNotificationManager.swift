import Foundation
import UserNotifications
import UIKit

@MainActor
final class PushNotificationManager: NSObject, ObservableObject {
    static let shared = PushNotificationManager()
    private override init() { super.init() }

    @Published var pendingRoute: AppRoute?

    // Called once at launch
    func setup() {
        UNUserNotificationCenter.current().delegate = self
    }

    func requestPermission() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            if granted {
                await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
            }
            AppPreferences.pushEnabled = granted
            return granted
        } catch {
            return false
        }
    }

    func handleDeviceToken(_ tokenData: Data) async {
        let token = tokenData.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(token, forKey: "lms_native_push_token")
        await syncToken()
    }

    func syncToken() async {
        guard AuthSession.shared.isAuthenticated,
              let token = UserDefaults.standard.string(forKey: "lms_native_push_token") else { return }
        let body = NativePushTokenRequest(token: token, platform: "ios")
        try? await APIClient.shared.requestVoid(.registerNativePushToken, body: body)
    }

    func unregisterToken() async {
        guard let _ = UserDefaults.standard.string(forKey: "lms_native_push_token") else { return }
        try? await APIClient.shared.requestVoid(.unregisterNativePushToken)
        UserDefaults.standard.removeObject(forKey: "lms_native_push_token")
    }

    func handleNotificationPayload(_ userInfo: [AnyHashable: Any]) {
        if let route = userInfo["route"] as? String {
            pendingRoute = DeepLinkHandler.resolve(route: route)
        }
    }
}

extension PushNotificationManager: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        Task { @MainActor in
            self.handleNotificationPayload(userInfo)
        }
        completionHandler()
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }
}
