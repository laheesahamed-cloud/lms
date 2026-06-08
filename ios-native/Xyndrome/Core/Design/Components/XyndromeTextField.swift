import SwiftUI

struct XyndromeTextField: View {
    let title: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType?
    var autocapitalization: TextInputAutocapitalization = .sentences

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
            Text(title)
                .font(XyndromeTheme.Typography.footnote())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .textCase(.uppercase)
                .tracking(0.5)

            TextField("", text: $text)
                .keyboardType(keyboardType)
                .textContentType(textContentType)
                .textInputAutocapitalization(autocapitalization)
                .font(XyndromeTheme.Typography.body())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                .padding(XyndromeTheme.Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .fill(XyndromeTheme.Colors.surfaceSecondary)
                )
        }
    }
}

struct XyndromeSecureField: View {
    let title: String
    @Binding var text: String
    var textContentType: UITextContentType? = .password
    @State private var isVisible = false

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
            Text(title)
                .font(XyndromeTheme.Typography.footnote())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .textCase(.uppercase)
                .tracking(0.5)

            HStack {
                Group {
                    if isVisible {
                        TextField("", text: $text)
                    } else {
                        SecureField("", text: $text)
                    }
                }
                .textContentType(textContentType)
                .font(XyndromeTheme.Typography.body())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                Button {
                    isVisible.toggle()
                } label: {
                    Image(systemName: isVisible ? "eye.slash" : "eye")
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)
                }
            }
            .padding(XyndromeTheme.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                    .fill(XyndromeTheme.Colors.surfaceSecondary)
            )
        }
    }
}
