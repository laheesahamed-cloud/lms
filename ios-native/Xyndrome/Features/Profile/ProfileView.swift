import SwiftUI

@Observable
@MainActor
final class ProfileViewModel {
    nonisolated init() {}
    var fullName = ""
    var isLoading = false
    var isSaving = false
    var error: String?
    var successMessage: String?

    func populate(from user: User) {
        fullName = user.fullName
    }

    func save(currentUser: User) async {
        guard !fullName.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "Full name cannot be empty."
            return
        }
        isSaving = true
        error = nil
        successMessage = nil
        defer { isSaving = false }
        do {
            try await AuthStore.shared.updateProfile(fullName: fullName, avatarKey: currentUser.avatarKey)
            successMessage = "Profile updated."
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct ProfileView: View {
    @State private var vm = ProfileViewModel()
    @Environment(AuthSession.self) var auth
    @Environment(\.horizontalSizeClass) var sizeClass
    @AppStorage("pref_color_scheme") private var preferredColorSchemeRaw = AppPreferences.ColorScheme.system.rawValue
    @State private var showSignOutConfirm = false
    @State private var showChangePassword = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                RootTabHeader(title: "Profile")

                VStack(spacing: XyndromeTheme.Spacing.xl) {
                    // Avatar / name header
                    if let user = auth.user {
                        VStack(spacing: XyndromeTheme.Spacing.sm) {
                            Circle()
                                .fill(XyndromeTheme.Colors.primary.opacity(0.15))
                                .frame(width: 88, height: 88)
                                .overlay {
                                    Text(String(user.fullName.prefix(1)).uppercased())
                                        .font(.system(size: 36, weight: .semibold, design: .rounded))
                                        .foregroundStyle(XyndromeTheme.Colors.primary)
                                }

                            Text(user.fullName)
                                .font(XyndromeTheme.Typography.title2())
                                .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                            Text(user.email)
                                .font(XyndromeTheme.Typography.subheadline())
                                .foregroundStyle(XyndromeTheme.Colors.textSecondary)

                            Text(user.role.capitalized)
                                .font(XyndromeTheme.Typography.caption())
                                .foregroundStyle(XyndromeTheme.Colors.primary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Capsule().fill(XyndromeTheme.Colors.primary.opacity(0.1)))
                        }
                        .padding(.top, XyndromeTheme.Spacing.sm)
                    }

                    // Edit form
                    if let user = auth.user {
                        VStack(spacing: XyndromeTheme.Spacing.md) {
                            XyndromeTextField(
                                title: "Full Name",
                                text: $vm.fullName,
                                textContentType: .name
                            )

                            if let error = vm.error {
                                HStack {
                                    Image(systemName: "exclamationmark.circle.fill")
                                    Text(error)
                                }
                                .font(XyndromeTheme.Typography.footnote())
                                .foregroundStyle(XyndromeTheme.Colors.error)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            if let success = vm.successMessage {
                                HStack {
                                    Image(systemName: "checkmark.circle.fill")
                                    Text(success)
                                }
                                .font(XyndromeTheme.Typography.footnote())
                                .foregroundStyle(XyndromeTheme.Colors.success)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            Button("Save Changes") {
                                Task { await vm.save(currentUser: user) }
                            }
                            .buttonStyle(PrimaryButtonStyle())
                            .frame(maxWidth: .infinity)
                            .disabled(vm.isSaving)
                        }
                        .padding(.horizontal, XyndromeTheme.Spacing.md)
                        .onAppear { vm.populate(from: user) }
                    }

                    Divider().padding(.horizontal, XyndromeTheme.Spacing.md)

                    VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
                        Text("Theme")
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                        Picker("Theme", selection: $preferredColorSchemeRaw) {
                            Text("System").tag(AppPreferences.ColorScheme.system.rawValue)
                            Text("Light").tag(AppPreferences.ColorScheme.light.rawValue)
                            Text("Dark").tag(AppPreferences.ColorScheme.dark.rawValue)
                        }
                        .pickerStyle(.segmented)
                    }
                    .padding(XyndromeTheme.Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                            .fill(XyndromeTheme.Colors.surfaceSecondary)
                    )
                    .padding(.horizontal, XyndromeTheme.Spacing.md)

                    Divider().padding(.horizontal, XyndromeTheme.Spacing.md)

                    // Action buttons
                    VStack(spacing: XyndromeTheme.Spacing.sm) {
                        NavigationLink(destination: BillingView()) {
                            HStack {
                                Image(systemName: "creditcard.fill")
                                    .foregroundStyle(XyndromeTheme.Colors.primary)
                                Text("Subscription & Billing")
                                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
                            }
                            .padding(XyndromeTheme.Spacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                    .fill(XyndromeTheme.Colors.surfaceSecondary)
                            )
                        }

                        NavigationLink(destination: BookmarksView()) {
                            HStack {
                                Image(systemName: "bookmark.fill")
                                    .foregroundStyle(XyndromeTheme.Colors.primary)
                                Text("Saved Items")
                                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
                            }
                            .padding(XyndromeTheme.Spacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                    .fill(XyndromeTheme.Colors.surfaceSecondary)
                            )
                        }

                        NavigationLink(destination: StudyPlannerView()) {
                            HStack {
                                Image(systemName: "calendar")
                                    .foregroundStyle(XyndromeTheme.Colors.primary)
                                Text("Study Planner")
                                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
                            }
                            .padding(XyndromeTheme.Spacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                    .fill(XyndromeTheme.Colors.surfaceSecondary)
                            )
                        }

                        NavigationLink(destination: NotificationsListView()) {
                            HStack {
                                Image(systemName: "bell.fill")
                                    .foregroundStyle(XyndromeTheme.Colors.primary)
                                Text("Notifications")
                                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
                            }
                            .padding(XyndromeTheme.Spacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                    .fill(XyndromeTheme.Colors.surfaceSecondary)
                            )
                        }

                        Button {
                            showSignOutConfirm = true
                        } label: {
                            HStack {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .foregroundStyle(XyndromeTheme.Colors.error)
                                Text("Sign Out")
                                    .foregroundStyle(XyndromeTheme.Colors.error)
                                Spacer()
                            }
                            .padding(XyndromeTheme.Spacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                    .fill(XyndromeTheme.Colors.error.opacity(0.08))
                            )
                        }
                    }
                    .padding(.horizontal, XyndromeTheme.Spacing.md)
                    .padding(.bottom, XyndromeTheme.Spacing.xxl)
                }
            }
            .pageFrame(maxWidth: 640)
        }
        .background(XyndromeTheme.Colors.surface.ignoresSafeArea())
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(sizeClass == .regular ? .large : .inline)
        .toolbar(sizeClass == .regular ? .visible : .hidden, for: .navigationBar)
        .alert("Sign Out?", isPresented: $showSignOutConfirm) {
            Button("Sign Out", role: .destructive) {
                Task { await AuthStore.shared.logout() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You will need to sign in again to continue.")
        }
    }
}
