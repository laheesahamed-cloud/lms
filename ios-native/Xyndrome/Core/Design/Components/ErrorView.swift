import SwiftUI

struct ErrorView: View {
    let message: String
    var retryLabel: String = "Try Again"
    var onRetry: (() -> Void)?

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.lg) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 44))
                .foregroundStyle(XyndromeTheme.Colors.warning)

            VStack(spacing: XyndromeTheme.Spacing.xs) {
                Text("Something went wrong")
                    .font(XyndromeTheme.Typography.headline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                Text(message)
                    .font(XyndromeTheme.Typography.subheadline())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            if let onRetry {
                Button(retryLabel, action: onRetry)
                    .buttonStyle(PrimaryButtonStyle())
            }
        }
        .padding(XyndromeTheme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    var message: String?
    var actionLabel: String?
    var onAction: (() -> Void)?

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 52))
                .foregroundStyle(XyndromeTheme.Colors.textMuted)

            VStack(spacing: XyndromeTheme.Spacing.xs) {
                Text(title)
                    .font(XyndromeTheme.Typography.title3())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                if let message {
                    Text(message)
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }

            if let actionLabel, let onAction {
                Button(actionLabel, action: onAction)
                    .buttonStyle(PrimaryButtonStyle())
            }
        }
        .padding(XyndromeTheme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Button Styles

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(XyndromeTheme.Typography.headline())
            .foregroundStyle(.white)
            .padding(.horizontal, XyndromeTheme.Spacing.xl)
            .padding(.vertical, XyndromeTheme.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                    .fill(XyndromeTheme.Colors.primary)
                    .opacity(configuration.isPressed ? 0.85 : 1)
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(XyndromeTheme.Typography.headline())
            .foregroundStyle(XyndromeTheme.Colors.primary)
            .padding(.horizontal, XyndromeTheme.Spacing.xl)
            .padding(.vertical, XyndromeTheme.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                    .strokeBorder(XyndromeTheme.Colors.primary, lineWidth: 1.5)
            )
            .opacity(configuration.isPressed ? 0.75 : 1)
    }
}

struct DestructiveButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(XyndromeTheme.Typography.headline())
            .foregroundStyle(.white)
            .padding(.horizontal, XyndromeTheme.Spacing.xl)
            .padding(.vertical, XyndromeTheme.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                    .fill(XyndromeTheme.Colors.error)
                    .opacity(configuration.isPressed ? 0.85 : 1)
            )
    }
}
