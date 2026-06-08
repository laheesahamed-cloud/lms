import SwiftUI

// MARK: - Size class helpers

extension View {
    /// Caps content width for readability on large screens and centers it.
    func pageFrame(maxWidth: CGFloat = 860) -> some View {
        self
            .frame(maxWidth: maxWidth)
            .frame(maxWidth: .infinity)
    }
}

/// Returns horizontal padding appropriate for the current size class.
func pagePadding(_ sizeClass: UserInterfaceSizeClass?) -> CGFloat {
    sizeClass == .regular ? XyndromeTheme.Spacing.xl : XyndromeTheme.Spacing.md
}

/// Returns `GridItem` columns that scale with size class.
/// - compact:  iPhone portrait
/// - regular:  iPad / Mac Catalyst
func adaptiveColumns(
    compact: Int = 2,
    regular: Int = 3,
    sizeClass: UserInterfaceSizeClass?
) -> [GridItem] {
    let n = sizeClass == .regular ? regular : compact
    return Array(
        repeating: GridItem(.flexible(), spacing: XyndromeTheme.Spacing.sm),
        count: n
    )
}

// MARK: - Sidebar navigation

enum SidebarRoute: String, CaseIterable, Hashable {
    case dashboard, courses, quizzes, study, profile

    var label: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .courses:   return "Courses"
        case .quizzes:   return "Quizzes"
        case .study:     return "Study"
        case .profile:   return "Profile"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "house.fill"
        case .courses:   return "books.vertical.fill"
        case .quizzes:   return "checkmark.circle.fill"
        case .study:     return "square.grid.2x2.fill"
        case .profile:   return "person.crop.circle.fill"
        }
    }
}

struct SidebarView: View {
    @Binding var selection: SidebarRoute?
    @Environment(AuthSession.self) var auth

    var body: some View {
        List(SidebarRoute.allCases, id: \.self, selection: $selection) { route in
            Label(route.label, systemImage: route.icon)
        }
        .navigationTitle("Xyndrome")
        .listStyle(.sidebar)
        .tint(XyndromeTheme.Colors.primary)
    }
}

@ViewBuilder
func sidebarDetail(for route: SidebarRoute?) -> some View {
    switch route ?? .dashboard {
    case .dashboard: NavigationStack { StudentDashboardView() }
    case .courses:   NavigationStack { CoursesView() }
    case .quizzes:   NavigationStack { QuizListView() }
    case .study:     NavigationStack { StudyHubView() }
    case .profile:   NavigationStack { ProfileView() }
    }
}
