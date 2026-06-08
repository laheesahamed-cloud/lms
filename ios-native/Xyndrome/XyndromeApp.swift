import SwiftUI
import UserNotifications

@main
struct XyndromeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @AppStorage("pref_color_scheme") private var preferredColorSchemeRaw = AppPreferences.ColorScheme.system.rawValue
    @State private var authSession = AuthSession.shared

    init() {
        PushNotificationManager.shared.setup()
        configureAppearance()
    }

    var body: some Scene {
        WindowGroup {
            AppRouter()
                .environment(authSession)
                .preferredColorScheme(preferredColorScheme)
                .task {
                    await authSession.restoreSession()
                }
                .onReceive(NotificationCenter.default.publisher(
                    for: UIApplication.didBecomeActiveNotification
                )) { _ in
                    UNUserNotificationCenter.current().setBadgeCount(0) { _ in }
                }
        }
    }

    private var preferredColorScheme: ColorScheme? {
        switch AppPreferences.ColorScheme(rawValue: preferredColorSchemeRaw) ?? .system {
        case .light: return .light
        case .dark: return .dark
        case .system: return nil
        }
    }

    private func configureAppearance() {
        // Tab bar background
        let tabBarAppearance = UITabBarAppearance()
        tabBarAppearance.configureWithOpaqueBackground()
        UITabBar.appearance().standardAppearance = tabBarAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabBarAppearance

        // Navigation bar
        let navBarAppearance = UINavigationBarAppearance()
        navBarAppearance.configureWithOpaqueBackground()
        UINavigationBar.appearance().standardAppearance = navBarAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navBarAppearance
    }
}

// MARK: - AppDelegate bridge for APNs token
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { await PushNotificationManager.shared.handleDeviceToken(deviceToken) }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Silently fail — push is non-critical
    }
}
