import SwiftUI

struct AppRouter: View {
    @Environment(AuthSession.self) var auth
    @Environment(\.horizontalSizeClass) var sizeClass
    @State private var selectedTab = 0
    @State private var sidebarSelection: SidebarRoute? = .dashboard

    var body: some View {
        ZStack {
            XyndromeTheme.Colors.surface.ignoresSafeArea()

            Group {
                if auth.isHydrating {
                    SplashView()
                        .transition(.opacity)
                } else if !auth.isAuthenticated {
                    LoginView()
                        .transition(.opacity)
                } else if auth.user?.isPending == true {
                    PendingAccountView()
                        .transition(.opacity)
                } else if sizeClass == .regular {
                    SplitAppShell(selection: $sidebarSelection)
                        .transition(.opacity)
                } else {
                    MainTabView(selectedTab: $selectedTab)
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: auth.isHydrating)
            .animation(.easeInOut(duration: 0.3), value: auth.isAuthenticated)
        }
        .overlay {
            if auth.sessionExpired {
                SessionExpiredOverlay()
            }
        }
    }
}

// MARK: - iPad / Mac split view shell

struct SplitAppShell: View {
    @Binding var selection: SidebarRoute?

    var body: some View {
        NavigationSplitView(columnVisibility: .constant(.all)) {
            SidebarView(selection: $selection)
                .navigationSplitViewColumnWidth(min: 200, ideal: 230, max: 280)
        } detail: {
            sidebarDetail(for: selection)
        }
        .navigationSplitViewStyle(.balanced)
    }
}

struct MainTabView: View {
    @Binding var selectedTab: Int

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                StudentDashboardView()
            }
            .tabItem {
                Label("Dashboard", systemImage: "house.fill")
            }
            .tag(0)

            NavigationStack {
                CoursesView()
            }
            .tabItem {
                Label("Courses", systemImage: "books.vertical.fill")
            }
            .tag(1)

            NavigationStack {
                QuizListView()
            }
            .tabItem {
                Label("Quizzes", systemImage: "checkmark.circle.fill")
            }
            .tag(2)

            NavigationStack {
                StudyHubView()
            }
            .tabItem {
                Label("Study", systemImage: "square.grid.2x2.fill")
            }
            .tag(3)

            NavigationStack {
                ProfileView()
            }
            .tabItem {
                Label("Profile", systemImage: "person.crop.circle.fill")
            }
            .tag(4)
        }
        .tint(XyndromeTheme.Colors.primary)
        .onChange(of: selectedTab) { _, newTab in
            AppPreferences.lastVisitedTab = newTab
        }
        .onAppear {
            selectedTab = AppPreferences.lastVisitedTab
        }
    }
}

struct StudyHubView: View {
    @Environment(\.horizontalSizeClass) var sizeClass

    var body: some View {
        VStack(spacing: 0) {
            RootTabHeader(title: "Study")

            List {
                Section {
                    NavigationLink {
                        StudentNotesView()
                    } label: {
                        StudyDestinationRow(
                            title: "Notes",
                            subtitle: "Lesson notebooks with highlights and written notes",
                            icon: "note.text",
                            tint: XyndromeTheme.Colors.success
                        )
                    }

                    NavigationLink {
                        AiNotesListView()
                    } label: {
                        StudyDestinationRow(
                            title: "AI Notes",
                            subtitle: "Study notes and generated lesson summaries",
                            icon: "brain.head.profile",
                            tint: XyndromeTheme.Colors.accent
                        )
                    }

                    NavigationLink {
                        FlashcardsLibraryView()
                    } label: {
                        StudyDestinationRow(
                            title: "Flashcards",
                            subtitle: "Review decks generated from AI notes",
                            icon: "rectangle.on.rectangle.angled",
                            tint: XyndromeTheme.Colors.primary
                        )
                    }

                    NavigationLink {
                        StudyPlannerView()
                    } label: {
                        StudyDestinationRow(
                            title: "Planner",
                            subtitle: "Personal tasks and generated study agenda",
                            icon: "calendar.badge.clock",
                            tint: XyndromeTheme.Colors.success
                        )
                    }
                }

                Section {
                    NavigationLink {
                        BookmarksView()
                    } label: {
                        StudyDestinationRow(
                            title: "Saved",
                            subtitle: "Bookmarked notes, lessons, and quiz items",
                            icon: "bookmark.fill",
                            tint: XyndromeTheme.Colors.warning
                        )
                    }

                    NavigationLink {
                        NotificationsListView()
                    } label: {
                        StudyDestinationRow(
                            title: "Notifications",
                            subtitle: "Course, quiz, and account updates",
                            icon: "bell.badge.fill",
                            tint: XyndromeTheme.Colors.error
                        )
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .contentMargins(.top, XyndromeTheme.Spacing.xs, for: .scrollContent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(XyndromeTheme.Colors.surface)
        .navigationTitle("Study")
        .navigationBarTitleDisplayMode(sizeClass == .regular ? .large : .inline)
        .toolbar(sizeClass == .regular ? .visible : .hidden, for: .navigationBar)
    }
}

struct StudyDestinationRow: View {
    let title: String
    let subtitle: String
    let icon: String
    let tint: Color

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.md) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(tint.opacity(0.14))
                .frame(width: 44, height: 44)
                .overlay {
                    Image(systemName: icon)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(tint)
                }

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                Text(title)
                    .font(XyndromeTheme.Typography.headline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                Text(subtitle)
                    .font(XyndromeTheme.Typography.footnote())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, XyndromeTheme.Spacing.xs)
    }
}

struct SplashView: View {
    var body: some View {
        ZStack {
            XyndromeTheme.Colors.surface.ignoresSafeArea()
            VStack(spacing: XyndromeTheme.Spacing.lg) {
                ZStack {
                    Circle()
                        .fill(XyndromeTheme.Colors.primary)
                        .frame(width: 72, height: 72)
                    Text("X")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                ProgressView()
                    .tint(XyndromeTheme.Colors.primary)
            }
        }
    }
}

struct PendingAccountView: View {
    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.xl) {
            Image(systemName: "clock.badge.checkmark")
                .font(.system(size: 64))
                .foregroundStyle(XyndromeTheme.Colors.warning)

            VStack(spacing: XyndromeTheme.Spacing.sm) {
                Text("Account Pending")
                    .font(XyndromeTheme.Typography.title2())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                Text("Your account is awaiting approval. You'll be notified once it's activated.")
                    .font(XyndromeTheme.Typography.body())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            Button("Sign Out") {
                Task { await AuthStore.shared.logout() }
            }
            .buttonStyle(SecondaryButtonStyle())
        }
        .padding(XyndromeTheme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(XyndromeTheme.Colors.surface.ignoresSafeArea())
    }
}

struct SessionExpiredOverlay: View {
    var body: some View {
        ZStack {
            Color.black.opacity(0.5).ignoresSafeArea()
            VStack(spacing: XyndromeTheme.Spacing.lg) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(.white)

                Text("Session Expired")
                    .font(XyndromeTheme.Typography.title2())
                    .foregroundStyle(.white)

                Text("Please sign in again to continue.")
                    .font(XyndromeTheme.Typography.body())
                    .foregroundStyle(.white.opacity(0.8))

                Button("Sign In") {
                    AuthSession.shared.signOut()
                }
                .buttonStyle(PrimaryButtonStyle())
            }
            .padding(XyndromeTheme.Spacing.xl)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.xl)
                    .fill(XyndromeTheme.Colors.surface)
            )
            .padding(.horizontal, XyndromeTheme.Spacing.xl)
        }
    }
}
