import SwiftUI

struct ResetPasswordView: View {
    let resetToken: String
    @State private var vm = AuthViewModel()
    @Environment(\.dismiss) var dismiss
    @State private var navigateToLogin = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: XyndromeTheme.Spacing.xl) {
                    VStack(spacing: XyndromeTheme.Spacing.xs) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 52))
                            .foregroundStyle(XyndromeTheme.Colors.primary)
                            .padding(.top, XyndromeTheme.Spacing.xl)

                        Text("New Password")
                            .font(XyndromeTheme.Typography.title2())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                        Text("Choose a strong password for your account.")
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
                        }

                        if vm.successMessage == nil {
                            XyndromeSecureField(
                                title: "New Password",
                                text: $vm.newPassword,
                                textContentType: .newPassword
                            )

                            XyndromeSecureField(
                                title: "Confirm New Password",
                                text: $vm.confirmNewPassword,
                                textContentType: .newPassword
                            )

                            if let error = vm.errorMessage {
                                HStack {
                                    Image(systemName: "exclamationmark.circle.fill")
                                    Text(error)
                                }
                                .font(XyndromeTheme.Typography.footnote())
                                .foregroundStyle(XyndromeTheme.Colors.error)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            Button("Set New Password") {
                                Task {
                                    vm.resetToken = resetToken
                                    _ = await vm.resetPassword()
                                }
                            }
                            .buttonStyle(PrimaryButtonStyle())
                            .frame(maxWidth: .infinity)
                            .disabled(vm.isLoading)
                        } else {
                            Button("Sign In") { navigateToLogin = true }
                                .buttonStyle(PrimaryButtonStyle())
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.horizontal, XyndromeTheme.Spacing.xl)
                }
            }
            .background(XyndromeTheme.Colors.surface.ignoresSafeArea())
            .navigationTitle("Reset Password")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
