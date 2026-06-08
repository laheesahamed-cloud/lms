import SwiftUI

enum XyndromeTheme {

    // MARK: - Brand Colors
    enum Colors {
        // Primary brand blue (matches --color-primary in web CSS)
        static let primary = Color(hex: "#3B82F6")
        static let primaryDark = Color(hex: "#2563EB")
        static let primaryLight = Color(hex: "#93C5FD")

        // Accent
        static let accent = Color(hex: "#6366F1")

        // Semantic
        static let success = Color(hex: "#22C55E")
        static let warning = Color(hex: "#F59E0B")
        static let error = Color(hex: "#EF4444")
        static let info = Color(hex: "#3B82F6")

        // Surface — UIKit semantic colors, adapt automatically to light/dark mode
        static let surface = Color(UIColor.systemBackground)
        static let surfaceSecondary = Color(UIColor.secondarySystemBackground)
        static let surfaceTertiary = Color(UIColor.tertiarySystemBackground)

        // Text
        static let textPrimary = Color(UIColor.label)
        static let textSecondary = Color(UIColor.secondaryLabel)
        static let textMuted = Color(UIColor.tertiaryLabel)

        // Score colors
        static func scoreColor(_ percent: Double) -> Color {
            switch percent {
            case 80...100: return success
            case 60..<80: return warning
            default: return error
            }
        }
    }

    // MARK: - Typography
    enum Typography {
        static func largeTitle() -> Font { .system(size: 34, weight: .bold, design: .rounded) }
        static func title1() -> Font { .system(size: 28, weight: .bold, design: .rounded) }
        static func title2() -> Font { .system(size: 22, weight: .semibold, design: .rounded) }
        static func title3() -> Font { .system(size: 20, weight: .semibold, design: .rounded) }
        static func headline() -> Font { .system(size: 17, weight: .semibold) }
        static func body() -> Font { .system(size: 17, weight: .regular) }
        static func callout() -> Font { .system(size: 16, weight: .regular) }
        static func subheadline() -> Font { .system(size: 15, weight: .regular) }
        static func footnote() -> Font { .system(size: 13, weight: .regular) }
        static func caption() -> Font { .system(size: 12, weight: .regular) }
        static func caption2() -> Font { .system(size: 11, weight: .regular) }
    }

    // MARK: - Spacing
    enum Spacing {
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
    }

    // MARK: - Corner Radius
    enum Radius {
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let full: CGFloat = 9999
    }

    // MARK: - Shadow
    enum Shadow {
        static func card() -> some ViewModifier { CardShadow() }
    }
}

private struct CardShadow: ViewModifier {
    @Environment(\.colorScheme) var scheme
    func body(content: Content) -> some View {
        content.shadow(
            color: scheme == .dark
                ? Color.black.opacity(0.4)
                : Color.black.opacity(0.08),
            radius: 8, x: 0, y: 2
        )
    }
}

// MARK: - Color hex init
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6:
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: 1
        )
    }
}

struct RootTabHeader: View {
    let title: String
    @Environment(\.horizontalSizeClass) var sizeClass

    var body: some View {
        // On iPad/Mac the NavigationSplitView sidebar and nav title provide
        // the same context, so the inline header is redundant.
        if sizeClass != .regular {
            HStack {
                Text(title)
                    .font(XyndromeTheme.Typography.title1())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .accessibilityAddTraits(.isHeader)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, XyndromeTheme.Spacing.md)
            .padding(.top, XyndromeTheme.Spacing.sm)
            .padding(.bottom, XyndromeTheme.Spacing.xs)
        }
    }
}
