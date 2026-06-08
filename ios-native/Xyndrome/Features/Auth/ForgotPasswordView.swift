import SwiftUI

struct ForgotPasswordView: View {
    @State private var vm = AuthViewModel()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: XyndromeTheme.Spacing.xl) {
                VStack(spacing: XyndromeTheme.Spacing.xs) {
                    Image(systemName: "lock.rotation")
                        .font(.system(size: 52))
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                        .padding(.top, XyndromeTheme.Spacing.xl)

                    Text("Reset Password")
                        .font(XyndromeTheme.Typography.title2())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                    Text("Enter your email and we'll send you a reset link.")
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: XyndromeTheme.Spacing.md) {
                    if let success = vm.successMessage {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                            Text(success)
                        }
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.success)
                        .padding(XyndromeTheme.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                .fill(XyndromeTheme.Colors.success.opacity(0.1))
                        )
                    }

                    if vm.successMessage == nil {
                        XyndromeTextField(
                            title: "Email",
                            text: $vm.email,
                            keyboardType: .emailAddress,
                            textContentType: .emailAddress,
                            autocapitalization: .never
                        )
                    }

                    if let error = vm.errorMessage {
                        HStack {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text(error)
                        }
                        .font(XyndromeTheme.Typography.footnote())
                        .foregroundStyle(XyndromeTheme.Colors.error)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if vm.successMessage == nil {
                        Button("Send Reset Link") {
                            Task { await vm.forgotPassword() }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .frame(maxWidth: .infinity)
                        .disabled(vm.isLoading)
                    } else {
                        Button("Back to Sign In") { dismiss() }
                            .buttonStyle(SecondaryButtonStyle())
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, XyndromeTheme.Spacing.xl)
            }
        }
        .background(XyndromeTheme.Colors.surface.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle("Forgot Password")
    }
}

