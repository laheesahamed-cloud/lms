import SwiftUI

struct LoadingView: View {
    var message: String = "Loading..."

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.md) {
            ProgressView()
                .scaleEffect(1.2)
                .tint(XyndromeTheme.Colors.primary)
            Text(message)
                .font(XyndromeTheme.Typography.subheadline())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(XyndromeTheme.Colors.surface)
    }
}

struct InlineLoadingView: View {
    var body: some View {
        HStack {
            Spacer()
            ProgressView().tint(XyndromeTheme.Colors.primary)
            Spacer()
        }
        .padding(.vertical, XyndromeTheme.Spacing.xl)
    }
}
