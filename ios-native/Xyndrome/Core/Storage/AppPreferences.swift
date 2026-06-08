import Foundation

enum AppPreferences {
    private enum Key: String {
        case colorScheme = "pref_color_scheme"
        case lastVisitedTab = "pref_last_tab"
        case pushEnabled = "pref_push_enabled"
        case hasCompletedOnboarding = "pref_onboarding_done"
    }

    enum ColorScheme: String {
        case system, light, dark
    }

    static var colorScheme: ColorScheme {
        get {
            let raw = UserDefaults.standard.string(forKey: Key.colorScheme.rawValue) ?? ""
            return ColorScheme(rawValue: raw) ?? .system
        }
        set {
            UserDefaults.standard.set(newValue.rawValue, forKey: Key.colorScheme.rawValue)
        }
    }

    static var lastVisitedTab: Int {
        get { UserDefaults.standard.integer(forKey: Key.lastVisitedTab.rawValue) }
        set { UserDefaults.standard.set(newValue, forKey: Key.lastVisitedTab.rawValue) }
    }

    static var pushEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: Key.pushEnabled.rawValue) }
        set { UserDefaults.standard.set(newValue, forKey: Key.pushEnabled.rawValue) }
    }

    static var hasCompletedOnboarding: Bool {
        get { UserDefaults.standard.bool(forKey: Key.hasCompletedOnboarding.rawValue) }
        set { UserDefaults.standard.set(newValue, forKey: Key.hasCompletedOnboarding.rawValue) }
    }

    static func clearAll() {
        [Key.colorScheme, .lastVisitedTab, .pushEnabled, .hasCompletedOnboarding].forEach {
            UserDefaults.standard.removeObject(forKey: $0.rawValue)
        }
    }
}
