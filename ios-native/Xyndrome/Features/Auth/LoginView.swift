import SwiftUI

struct LoginView: View {
    @State private var vm = AuthViewModel()
    @State private var navigateToRegister = false
    @State private var navigateToForgot = false
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Header
                    VStack(spacing: XyndromeTheme.Spacing.sm) {
                        ZStack {
                            Circle()
                                .fill(XyndromeTheme.Colors.primary)
                                .frame(width: 64, height: 64)
                            Text("X")
                                .font(.system(size: 32, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                        }
                        .padding(.top, XyndromeTheme.Spacing.xxl)

                        Text("xyndrome")
                            .font(XyndromeTheme.Typography.title1())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                        Text("Sign in to continue")
                            .font(XyndromeTheme.Typography.subheadline())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }
                    .padding(.bottom, XyndromeTheme.Spacing.xxl)

                    // Form
                    VStack(spacing: XyndromeTheme.Spacing.md) {
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
                            textContentType: .password
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

                        Button("Sign In") {
                            Task { await vm.login() }
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

                        Button("Forgot password?") {
                            navigateToForgot = true
                        }
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                    }
                    .padding(.horizontal, XyndromeTheme.Spacing.xl)

                    Divider()
                        .padding(.vertical, XyndromeTheme.Spacing.xl)
                        .padding(.horizontal, XyndromeTheme.Spacing.xl)

                    // Register CTA
                    HStack(spacing: XyndromeTheme.Spacing.xs) {
                        Text("New to xyndrome?")
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        Button("Create account") {
                            navigateToRegister = true
                        }
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                        .fontWeight(.semibold)
                    }
                    .font(XyndromeTheme.Typography.subheadline())
                    .padding(.bottom, XyndromeTheme.Spacing.xxl)
                }
            }
            .background(XyndromeTheme.Colors.surface.ignoresSafeArea())
            .navigationDestination(isPresented: $navigateToRegister) {
                RegisterView()
            }
            .navigationDestination(isPresented: $navigateToForgot) {
                ForgotPasswordView()
            }
            .navigationBarHidden(true)
        }
    }
}
