import SwiftUI

struct RegisterView: View {
    @State private var vm = AuthViewModel()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                VStack(spacing: XyndromeTheme.Spacing.xs) {
                    Text("Create Account")
                        .font(XyndromeTheme.Typography.title1())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    Text("Join thousands of students on xyndrome")
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }
                .padding(.top, XyndromeTheme.Spacing.xl)
                .padding(.bottom, XyndromeTheme.Spacing.xl)

                VStack(spacing: XyndromeTheme.Spacing.md) {
                    XyndromeTextField(
                        title: "Full Name",
                        text: $vm.fullName,
                        textContentType: .name
                    )

                    XyndromeTextField(
                        title: "Email",
                        text: $vm.email,
                        keyboardType: .emailAddress,
                        textContentType: .emailAddress,
                        autocapitalization: .never
                    )

                    XyndromeSecureField(
                        title: "Password",
                        text: $vm.password,
                        textContentType: .newPassword
                    )

                    XyndromeSecureField(
                        title: "Confirm Password",
                        text: $vm.confirmPassword,
                        textContentType: .newPassword
                    )

                    Toggle(isOn: $vm.acceptedTerms) {
                        Text("I accept the terms and privacy policy")
                            .font(XyndromeTheme.Typography.subheadline())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }
                    .toggleStyle(.switch)
                    .tint(XyndromeTheme.Colors.primary)

                    if let error = vm.errorMessage {
                        HStack {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text(error)
                        }
                        .font(XyndromeTheme.Typography.footnote())
                        .foregroundStyle(XyndromeTheme.Colors.error)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button("Create Account") {
                        Task { await vm.register() }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .frame(maxWidth: .infinity)
                    .disabled(vm.isLoading)
                    .overlay {
                        if vm.isLoading {
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                .fill(XyndromeTheme.Colors.primary)
                            ProgressView().tint(.white)
                        }
                    }
                }
                .padding(.horizontal, XyndromeTheme.Spacing.xl)

                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    Text("Already have an account?")
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    Button("Sign in") { dismiss() }
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                        .fontWeight(.semibold)
                }
                .font(XyndromeTheme.Typography.subheadline())
                .padding(.top, XyndromeTheme.Spacing.xl)
                .padding(.bottom, XyndromeTheme.Spacing.xxl)
            }
        }
        .background(XyndromeTheme.Colors.surface.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
    }
}
