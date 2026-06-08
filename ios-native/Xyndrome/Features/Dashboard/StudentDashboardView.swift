import SwiftUI

@Observable
@MainActor
final class DashboardViewModel {
    nonisolated init() {}
    var dashboard: DashboardResponse?
    var isLoading = false
    var error: String?

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let response: DashboardResponse = try await APIClient.shared.request(.studentDashboard)
            dashboard = response
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct StudentDashboardView: View {
    @State private var vm = DashboardViewModel()
    @Environment(AuthSession.self) var auth
    @Environment(\.horizontalSizeClass) var sizeClass

    private var firstName: String {
        guard let fullName = auth.user?.fullName.trimmingCharacters(in: .whitespacesAndNewlines), !fullName.isEmpty else {
            return "there"
        }
        return fullName.components(separatedBy: " ").first ?? fullName
    }

    private var hPad: CGFloat { pagePadding(sizeClass) }

    var body: some View {
        Group {
            if vm.isLoading && vm.dashboard == nil {
                LoadingView(message: "Loading study hub...")
            } else if let err = vm.error, vm.dashboard == nil {
                ErrorView(message: err, onRetry: { Task { await vm.load() } })
            } else if let dashboard = vm.dashboard {
                dashboardContent(dashboard)
            } else {
                EmptyStateView(
                    icon: "square.grid.2x2",
                    title: "Study Hub",
                    message: "Your dashboard will appear after the first sync."
                )
            }
        }
        .navigationTitle("Study Hub")
        .navigationBarTitleDisplayMode(sizeClass == .regular ? .large : .inline)
        .toolbar(sizeClass == .regular ? .visible : .hidden, for: .navigationBar)
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    private func dashboardContent(_ dashboard: DashboardResponse) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: XyndromeTheme.Spacing.lg) {
                StudyHubHeader()

                DashboardHeroSection(dashboard: dashboard, firstName: firstName)
                    .padding(.horizontal, hPad)

                DashboardMetricGrid(dashboard: dashboard)
                    .padding(.horizontal, hPad)

                CourseAndExamSection(dashboard: dashboard)
                    .padding(.horizontal, hPad)

                StudyStreakSection(dashboard: dashboard)
                    .padding(.horizontal, hPad)

                QuickActionSection()
                    .padding(.horizontal, hPad)

                StudyReadinessStack(dashboard: dashboard)
                    .padding(.horizontal, hPad)

                if let question = dashboard.questionOfDay {
                    DailyQuestionDashboardCard(question: question)
                        .padding(.horizontal, hPad)
                }

                StudyLevelSummaryCard(dashboard: dashboard)
                    .padding(.horizontal, hPad)
            }
            .padding(.bottom, XyndromeTheme.Spacing.xl)
            .pageFrame()
        }
        .background(XyndromeTheme.Colors.surface)
    }
}

// MARK: - Study Hub Shell

private struct StudyHubHeader: View {
    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
            RootTabHeader(title: "Study Hub")

            Text("Daily Focus")
                .font(XyndromeTheme.Typography.subheadline())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .padding(.horizontal, XyndromeTheme.Spacing.md)
        }
    }
}

private struct DashboardHeroSection: View {
    let dashboard: DashboardResponse
    let firstName: String

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.sm) {
            ContinueStudyHeroCard(dashboard: dashboard, firstName: firstName)
            DashboardMoodCard(mood: StudyMood.make(from: dashboard))
        }
    }
}

private struct ContinueStudyHeroCard: View {
    let dashboard: DashboardResponse
    let firstName: String

    private var primaryStep: StudyPlanItem? {
        dashboard.adaptivePlan?.first { ($0.status ?? "").lowercased() != "done" }
            ?? dashboard.adaptivePlan?.first
    }

    private var actionType: String {
        primaryStep?.actionType ?? "quiz"
    }

    private var actionTitle: String {
        switch actionType.lowercased() {
        case "note", "lesson":
            return "Open Notes"
        case "course":
            return "Open Course"
        case "planner":
            return "Open Plan"
        case "results":
            return "Review"
        default:
            return "Practice"
        }
    }

    private var focusCourse: String {
        nonEmpty(dashboard.focusCourse)
            ?? nonEmpty(dashboard.weakTopics?.first?.courseTitle)
            ?? dashboard.recentCourses?.first?.title
            ?? "Choose a course"
    }

    private var focusTopic: String {
        nonEmpty(dashboard.focusTopic)
            ?? dashboard.weakTopics?.first?.topicName
            ?? "Start your first quiz"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
            HStack(alignment: .top, spacing: XyndromeTheme.Spacing.md) {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                    Text("Continue where you left off")
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.primaryDark)
                        .textCase(.uppercase)

                    Text("Welcome back, \(firstName)")
                        .font(XyndromeTheme.Typography.title2())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .lineLimit(2)

                    Text(dashboard.progressNote ?? "Keep your study rhythm active with one focused move.")
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        .lineLimit(3)
                }

                Spacer(minLength: 0)

                DashboardReadinessBadge(score: dashboard.studyReadinessScore)
            }

            VStack(spacing: XyndromeTheme.Spacing.xs) {
                DashboardFocusChip(
                    label: "Course",
                    value: focusCourse,
                    icon: "books.vertical.fill",
                    tint: XyndromeTheme.Colors.primary
                )
                DashboardFocusChip(
                    label: "Focus",
                    value: focusTopic,
                    icon: "scope",
                    tint: XyndromeTheme.Colors.success
                )
            }

            Divider()

            HStack(spacing: XyndromeTheme.Spacing.sm) {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                    Text("Next study move")
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    Text(primaryStep?.title ?? focusTopic)
                        .font(XyndromeTheme.Typography.headline())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .lineLimit(2)
                }

                Spacer(minLength: XyndromeTheme.Spacing.sm)

                NavigationLink {
                    DashboardActionDestination(actionType: actionType)
                } label: {
                    Label(actionTitle, systemImage: "arrow.right")
                        .font(XyndromeTheme.Typography.subheadline())
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, XyndromeTheme.Spacing.md)
                        .frame(minHeight: 44)
                        .background(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                .fill(XyndromeTheme.Colors.primary)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(
                    LinearGradient(
                        colors: [
                            XyndromeTheme.Colors.primary.opacity(0.16),
                            XyndromeTheme.Colors.success.opacity(0.10),
                            XyndromeTheme.Colors.surfaceSecondary
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .strokeBorder(XyndromeTheme.Colors.primary.opacity(0.14), lineWidth: 1)
        }
        .modifier(XyndromeTheme.Shadow.card())
    }
}

private struct DashboardReadinessBadge: View {
    let score: Int

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.xxs) {
            ZStack {
                DashboardProgressRing(progress: Double(score) / 100, tint: XyndromeTheme.Colors.primary, size: 58, lineWidth: 7)
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(XyndromeTheme.Colors.primary)
            }

            Text("\(score)%")
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.semibold)
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Readiness \(score) percent")
    }
}

private struct DashboardFocusChip: View {
    let label: String
    let value: String
    let icon: String
    let tint: Color

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.sm) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(tint.opacity(0.14))
                .frame(width: 38, height: 38)
                .overlay {
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(tint)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(XyndromeTheme.Typography.caption2())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .textCase(.uppercase)
                Text(value)
                    .font(XyndromeTheme.Typography.subheadline())
                    .fontWeight(.semibold)
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .lineLimit(2)
            }

            Spacer(minLength: 0)
        }
        .padding(XyndromeTheme.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(XyndromeTheme.Colors.surface.opacity(0.78))
        )
    }
}

private struct DashboardMoodCard: View {
    let mood: StudyMood

    var body: some View {
        DashboardCard {
            HStack(alignment: .top, spacing: XyndromeTheme.Spacing.md) {
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                    .fill(mood.tint.opacity(0.14))
                    .frame(width: 48, height: 48)
                    .overlay {
                        Image(systemName: mood.icon)
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(mood.tint)
                    }

                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(mood.title)
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        Spacer(minLength: XyndromeTheme.Spacing.sm)
                        Text("\(mood.meter)%")
                            .font(XyndromeTheme.Typography.subheadline())
                            .fontWeight(.semibold)
                            .foregroundStyle(mood.tint)
                    }

                    Text(mood.message)
                        .font(XyndromeTheme.Typography.footnote())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        .lineLimit(2)

                    ProgressView(value: Double(mood.meter) / 100)
                        .tint(mood.tint)
                }
            }
        }
    }
}

// MARK: - Metrics

private struct DashboardMetricGrid: View {
    let dashboard: DashboardResponse
    @Environment(\.horizontalSizeClass) var sizeClass

    private var metrics: [DashboardMetric] {
        [
            DashboardMetric(
                title: "Courses",
                value: "\(dashboard.totalCourses ?? dashboard.recentCourses?.count ?? 0)",
                detail: dashboard.courseProgressSummary?.lessonSummary ?? "In progress",
                icon: "books.vertical.fill",
                tint: XyndromeTheme.Colors.primary
            ),
            DashboardMetric(
                title: "Readiness",
                value: "\(dashboard.studyReadinessScore)%",
                detail: dashboard.performance?.readinessLabel ?? "Baseline",
                icon: "gauge.with.dots.needle.67percent",
                tint: XyndromeTheme.Colors.success
            ),
            DashboardMetric(
                title: "Streak",
                value: "\(dashboard.studyStreakDays)d",
                detail: dashboard.performance?.consistencyLabel ?? "Current rhythm",
                icon: "flame.fill",
                tint: XyndromeTheme.Colors.warning
            ),
            DashboardMetric(
                title: "Attempts",
                value: "\(dashboard.totalAttemptCount)",
                detail: dashboard.averageScoreText,
                icon: "checkmark.circle.fill",
                tint: XyndromeTheme.Colors.accent
            )
        ]
    }

    var body: some View {
        LazyVGrid(
            columns: adaptiveColumns(compact: 2, regular: 4, sizeClass: sizeClass),
            spacing: XyndromeTheme.Spacing.sm
        ) {
            ForEach(metrics) { metric in
                DashboardMetricCard(metric: metric)
            }
        }
    }
}

private struct DashboardMetric: Identifiable {
    let id = UUID()
    let title: String
    let value: String
    let detail: String
    let icon: String
    let tint: Color
}

private struct DashboardMetricCard: View {
    let metric: DashboardMetric

    var body: some View {
        DashboardCard {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
                HStack {
                    Image(systemName: metric.icon)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(metric.tint)
                    Spacer(minLength: 0)
                }

                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                    Text(metric.value)
                        .font(XyndromeTheme.Typography.title2())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)

                    Text(metric.title)
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)

                    Text(metric.detail)
                        .font(XyndromeTheme.Typography.caption2())
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 108, alignment: .topLeading)
        }
    }
}

// MARK: - Course / Exam Cards

private struct CourseAndExamSection: View {
    let dashboard: DashboardResponse

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.sm) {
            CourseProgressDashboardCard(dashboard: dashboard)
            ExamCountdownDashboardCard(tasks: dashboard.upcomingTasks ?? [])
        }
    }
}

private struct CourseProgressDashboardCard: View {
    let dashboard: DashboardResponse

    private var courses: [Course] {
        dashboard.recentCourses ?? []
    }

    private var overallProgress: Double {
        dashboard.courseProgressSummary?.overallProgressPercent
            ?? courses.compactMap(\.progressPercent).average
            ?? 0
    }

    var body: some View {
        DashboardCard {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                HStack(alignment: .center, spacing: XyndromeTheme.Spacing.md) {
                    DashboardProgressRing(
                        progress: overallProgress / 100,
                        tint: XyndromeTheme.Colors.primary,
                        size: 72,
                        lineWidth: 8
                    )
                    .overlay {
                        Text("\(Int(overallProgress.rounded()))%")
                            .font(XyndromeTheme.Typography.caption())
                            .fontWeight(.semibold)
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    }

                    VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                        Text("Course progress")
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                        Text(dashboard.courseProgressSummary?.sourceLabel ?? "Lessons completed across your courses")
                            .font(XyndromeTheme.Typography.footnote())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                            .lineLimit(2)
                    }

                    Spacer(minLength: 0)
                }

                if courses.isEmpty {
                    DashboardEmptyLine(
                        icon: "books.vertical",
                        title: "No course progress yet",
                        subtitle: "Courses will appear after enrollment."
                    )
                } else {
                    VStack(spacing: XyndromeTheme.Spacing.sm) {
                        ForEach(courses.prefix(3)) { course in
                            DashboardCourseProgressRow(course: course)
                        }
                    }
                }

                NavigationLink {
                    CoursesView()
                } label: {
                    DashboardInlineAction(title: "View courses", icon: "arrow.right")
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct DashboardCourseProgressRow: View {
    let course: Course

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
            HStack(spacing: XyndromeTheme.Spacing.sm) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(course.title)
                        .font(XyndromeTheme.Typography.subheadline())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .lineLimit(2)

                    if let code = course.courseCode ?? course.examType {
                        Text(code)
                            .font(XyndromeTheme.Typography.caption2())
                            .foregroundStyle(XyndromeTheme.Colors.textMuted)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: XyndromeTheme.Spacing.sm)

                Text(formatPercent(course.progressPercent))
                    .font(XyndromeTheme.Typography.caption())
                    .fontWeight(.semibold)
                    .foregroundStyle(XyndromeTheme.Colors.primary)
            }

            ProgressView(value: (course.progressPercent ?? 0) / 100)
                .tint(XyndromeTheme.Colors.primary)
        }
    }
}

private struct ExamCountdownDashboardCard: View {
    let tasks: [AgendaItem]

    private var focusTask: AgendaItem? {
        tasks.first { ($0.type ?? "").localizedCaseInsensitiveContains("exam") } ?? tasks.first
    }

    var body: some View {
        DashboardCard {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                HStack(spacing: XyndromeTheme.Spacing.sm) {
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .fill(XyndromeTheme.Colors.warning.opacity(0.15))
                        .frame(width: 44, height: 44)
                        .overlay {
                            Image(systemName: "calendar.badge.clock")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(XyndromeTheme.Colors.warning)
                        }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Next deadline")
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        Text(focusTask?.dueDate.map(shortDateLabel) ?? "Nothing scheduled")
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }

                    Spacer(minLength: 0)
                }

                if let task = focusTask {
                    VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                        Text(task.title)
                            .font(XyndromeTheme.Typography.subheadline())
                            .fontWeight(.semibold)
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                            .lineLimit(2)

                        if let contextLine = task.contextLine {
                            Text(contextLine)
                                .font(XyndromeTheme.Typography.footnote())
                                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                                .lineLimit(2)
                        }
                    }
                } else {
                    DashboardEmptyLine(
                        icon: "checkmark.seal",
                        title: "Clear agenda",
                        subtitle: "Your planner has no immediate deadlines."
                    )
                }

                NavigationLink {
                    StudyPlannerView()
                } label: {
                    DashboardInlineAction(title: "Open planner", icon: "arrow.right")
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Streak

private struct StudyStreakSection: View {
    let dashboard: DashboardResponse

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            DashboardSectionHeader(title: "Daily rhythm")

            DashboardCard {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("\(dashboard.studyStreakDays) day streak")
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        Spacer(minLength: XyndromeTheme.Spacing.sm)
                        Text("\(dashboard.goalsCompletedCount)/\(dashboard.goals?.count ?? 3) goals")
                            .font(XyndromeTheme.Typography.caption())
                            .fontWeight(.semibold)
                            .foregroundStyle(XyndromeTheme.Colors.success)
                    }

                    StreakHeatmap(activeDays: dashboard.studyStreakDays)

                    if let trend = dashboard.performance?.trendLabel {
                        Label(trend, systemImage: "chart.line.uptrend.xyaxis")
                            .font(XyndromeTheme.Typography.footnote())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }
                }
            }
        }
    }
}

private struct StreakHeatmap: View {
    let activeDays: Int

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 5), count: 7)

    var body: some View {
        LazyVGrid(columns: columns, spacing: 5) {
            ForEach(0..<28, id: \.self) { index in
                let isActive = index >= max(0, 28 - min(activeDays, 28))
                RoundedRectangle(cornerRadius: 3)
                    .fill(isActive ? XyndromeTheme.Colors.success.opacity(0.38 + Double(index % 3) * 0.14) : XyndromeTheme.Colors.surfaceTertiary)
                    .frame(height: 12)
                    .accessibilityHidden(true)
            }
        }
    }
}

// MARK: - Quick Actions

private struct QuickActionSection: View {
    @Environment(\.horizontalSizeClass) var sizeClass

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            DashboardSectionHeader(title: "Quick actions")

            LazyVGrid(
                columns: adaptiveColumns(compact: 2, regular: 3, sizeClass: sizeClass),
                spacing: XyndromeTheme.Spacing.sm
            ) {
                NavigationLink {
                    QuizListView()
                } label: {
                    QuickActionTile(title: "Exams", icon: "doc.text.magnifyingglass", tint: XyndromeTheme.Colors.warning)
                }
                .buttonStyle(.plain)

                NavigationLink {
                    StudyPlannerView()
                } label: {
                    QuickActionTile(title: "Planner", icon: "calendar", tint: XyndromeTheme.Colors.success)
                }
                .buttonStyle(.plain)

                NavigationLink {
                    QuizListView()
                } label: {
                    QuickActionTile(title: "Q-Bank", icon: "questionmark.circle.fill", tint: XyndromeTheme.Colors.primary)
                }
                .buttonStyle(.plain)

                NavigationLink {
                    AiNotesListView()
                } label: {
                    QuickActionTile(title: "Notes", icon: "note.text", tint: XyndromeTheme.Colors.accent)
                }
                .buttonStyle(.plain)

                NavigationLink {
                    BookmarksView()
                } label: {
                    QuickActionTile(title: "Bookmarks", icon: "bookmark.fill", tint: XyndromeTheme.Colors.warning)
                }
                .buttonStyle(.plain)

                NavigationLink {
                    QuizListView()
                } label: {
                    QuickActionTile(title: "Weak areas", icon: "target", tint: XyndromeTheme.Colors.error)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct QuickActionTile: View {
    let title: String
    let icon: String
    let tint: Color

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.sm) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(tint.opacity(0.14))
                .frame(width: 38, height: 38)
                .overlay {
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(tint)
                }

            Text(title)
                .font(XyndromeTheme.Typography.subheadline())
                .fontWeight(.semibold)
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Spacer(minLength: 0)
        }
        .padding(XyndromeTheme.Spacing.sm)
        .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
        .modifier(XyndromeTheme.Shadow.card())
    }
}

// MARK: - Plan / Readiness

private struct StudyReadinessStack: View {
    let dashboard: DashboardResponse

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            DashboardSectionHeader(title: "Today")
            StudyPlanDashboardCard(dashboard: dashboard)
            UpcomingTasksDashboardCard(tasks: dashboard.upcomingTasks ?? [])
            AnalyticsSnapshotCard(dashboard: dashboard)
        }
    }
}

private struct StudyPlanDashboardCard: View {
    let dashboard: DashboardResponse

    private var steps: [DashboardPlanStep] {
        if let plan = dashboard.adaptivePlan, !plan.isEmpty {
            return plan.map {
                DashboardPlanStep(
                    id: $0.id,
                    title: $0.title,
                    description: $0.description ?? "Keep the feedback loop active.",
                    actionType: $0.actionType ?? "quiz",
                    status: $0.status ?? "next"
                )
            }
        }

        let weakTopic = dashboard.weakTopics?.first?.topicName ?? dashboard.focusTopic ?? "Practice"
        return [
            DashboardPlanStep(id: 1, title: "Practice \(weakTopic)", description: "Start with the highest-impact topic.", actionType: "quiz", status: "next"),
            DashboardPlanStep(id: 2, title: "Review one lesson", description: "Pair recall with a short lesson review.", actionType: "note", status: "queued"),
            DashboardPlanStep(id: 3, title: "Update planner", description: "Keep the next session visible.", actionType: "planner", status: "queued")
        ]
    }

    var body: some View {
        DashboardCard {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Adaptive plan")
                        .font(XyndromeTheme.Typography.headline())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    Spacer(minLength: XyndromeTheme.Spacing.sm)
                    Text("\(dashboard.goalsCompletedCount) done")
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.success)
                }

                VStack(spacing: XyndromeTheme.Spacing.md) {
                    ForEach(steps.prefix(3)) { step in
                        NavigationLink {
                            DashboardActionDestination(actionType: step.actionType)
                        } label: {
                            PlanStepRow(step: step)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

private struct DashboardPlanStep: Identifiable {
    let id: Int
    let title: String
    let description: String
    let actionType: String
    let status: String
}

private struct PlanStepRow: View {
    let step: DashboardPlanStep

    private var tint: Color {
        switch step.status.lowercased() {
        case "done", "completed":
            return XyndromeTheme.Colors.success
        case "next":
            return XyndromeTheme.Colors.primary
        default:
            return XyndromeTheme.Colors.textMuted
        }
    }

    private var icon: String {
        switch step.actionType.lowercased() {
        case "note", "lesson":
            return "note.text"
        case "planner":
            return "calendar"
        case "results":
            return "chart.bar.doc.horizontal"
        default:
            return "checkmark.circle"
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: XyndromeTheme.Spacing.sm) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(tint.opacity(0.14))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(tint)
                }

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                HStack(alignment: .firstTextBaseline, spacing: XyndromeTheme.Spacing.xs) {
                    Text(step.title)
                        .font(XyndromeTheme.Typography.subheadline())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .lineLimit(2)

                    Spacer(minLength: XyndromeTheme.Spacing.xs)

                    Text(step.status.capitalized)
                        .font(XyndromeTheme.Typography.caption2())
                        .fontWeight(.semibold)
                        .foregroundStyle(tint)
                        .padding(.horizontal, XyndromeTheme.Spacing.xs)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(tint.opacity(0.12))
                        )
                }

                Text(step.description)
                    .font(XyndromeTheme.Typography.footnote())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .lineLimit(2)
            }
        }
    }
}

private struct UpcomingTasksDashboardCard: View {
    let tasks: [AgendaItem]

    var body: some View {
        DashboardCard {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Upcoming")
                        .font(XyndromeTheme.Typography.headline())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    Spacer(minLength: XyndromeTheme.Spacing.sm)
                    Text("\(tasks.count)")
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                }

                if tasks.isEmpty {
                    DashboardEmptyLine(
                        icon: "calendar.badge.checkmark",
                        title: "No upcoming tasks",
                        subtitle: "Your next planner items will appear here."
                    )
                } else {
                    VStack(spacing: XyndromeTheme.Spacing.md) {
                        ForEach(tasks.prefix(3)) { task in
                            DashboardTaskRow(item: task)
                        }
                    }
                }
            }
        }
    }
}

private struct DashboardTaskRow: View {
    let item: AgendaItem

    var body: some View {
        HStack(alignment: .top, spacing: XyndromeTheme.Spacing.sm) {
            Circle()
                .fill(item.isCompleted ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.primary)
                .frame(width: 9, height: 9)
                .padding(.top, 5)

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                Text(item.title)
                    .font(XyndromeTheme.Typography.subheadline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .lineLimit(2)

                Text([item.contextLine, item.dueDate.map(shortDateLabel)].compactMap { $0 }.joined(separator: " • "))
                    .font(XyndromeTheme.Typography.caption())
                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
                    .lineLimit(2)
            }

            Spacer(minLength: 0)
        }
    }
}

private struct AnalyticsSnapshotCard: View {
    let dashboard: DashboardResponse

    private var scores: [Double] {
        let weekly = dashboard.performance?.weeklyScores ?? []
        if !weekly.isEmpty { return Array(weekly.suffix(7)) }
        return Array((dashboard.recentAttempts ?? []).compactMap(\.percentage).suffix(7))
    }

    private var deltaText: String {
        guard let delta = dashboard.performance?.scoreDelta else { return "Stable" }
        return delta > 0 ? "+\(delta) pts" : "\(delta) pts"
    }

    private var deltaTint: Color {
        guard let delta = dashboard.performance?.scoreDelta else { return XyndromeTheme.Colors.textSecondary }
        if delta > 0 { return XyndromeTheme.Colors.success }
        if delta < 0 { return XyndromeTheme.Colors.error }
        return XyndromeTheme.Colors.textSecondary
    }

    var body: some View {
        DashboardCard {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Analytics snapshot")
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        Text(dashboard.performance?.windowLabel ?? "Recent activity")
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }

                    Spacer(minLength: XyndromeTheme.Spacing.sm)

                    Text(deltaText)
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.semibold)
                        .foregroundStyle(deltaTint)
                }

                if scores.isEmpty {
                    DashboardEmptyLine(
                        icon: "chart.bar",
                        title: "No quiz activity yet",
                        subtitle: dashboard.performance?.emptyState ?? "Submit a quiz to build your trend."
                    )
                } else {
                    HStack(alignment: .bottom, spacing: 6) {
                        ForEach(Array(scores.enumerated()), id: \.offset) { _, score in
                            RoundedRectangle(cornerRadius: 3)
                                .fill(XyndromeTheme.Colors.primary.opacity(0.28 + min(max(score, 0), 100) / 160))
                                .frame(maxWidth: .infinity)
                                .frame(height: max(12, CGFloat(min(max(score, 0), 100)) * 0.72))
                                .accessibilityLabel("\(Int(score.rounded())) percent")
                        }
                    }
                    .frame(height: 82, alignment: .bottom)

                    HStack {
                        Text("Average \(formatPercent(dashboard.performance?.weeklyAverage ?? dashboard.avgScore))")
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        Spacer(minLength: XyndromeTheme.Spacing.sm)
                        Text("\(dashboard.performance?.weeklyAttempts ?? dashboard.totalAttemptCount) attempts")
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }
                }
            }
        }
    }
}

// MARK: - Daily Question / Level

private struct DailyQuestionDashboardCard: View {
    let question: DashboardQuestion

    var body: some View {
        DashboardCard {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Question of the day")
                        .font(XyndromeTheme.Typography.headline())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    Spacer(minLength: XyndromeTheme.Spacing.sm)
                    if let topic = nonEmpty(question.topicName ?? question.subjectName) {
                        Text(topic)
                            .font(XyndromeTheme.Typography.caption2())
                            .fontWeight(.semibold)
                            .foregroundStyle(XyndromeTheme.Colors.primary)
                            .lineLimit(1)
                    }
                }

                Text(question.questionText)
                    .font(XyndromeTheme.Typography.subheadline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .lineLimit(4)

                if !question.options.isEmpty {
                    VStack(spacing: XyndromeTheme.Spacing.xs) {
                        ForEach(question.options.prefix(3)) { option in
                            HStack(alignment: .top, spacing: XyndromeTheme.Spacing.xs) {
                                Text(option.optionLabel ?? "•")
                                    .font(XyndromeTheme.Typography.caption())
                                    .fontWeight(.semibold)
                                    .foregroundStyle(XyndromeTheme.Colors.primary)
                                    .frame(width: 24, alignment: .leading)

                                Text(option.optionText)
                                    .font(XyndromeTheme.Typography.footnote())
                                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                                    .lineLimit(2)

                                Spacer(minLength: 0)
                            }
                        }
                    }
                }

                NavigationLink {
                    QuizListView()
                } label: {
                    DashboardInlineAction(title: "Open practice", icon: "arrow.right")
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct StudyLevelSummaryCard: View {
    let dashboard: DashboardResponse

    private var level: DashboardLevelProgress {
        DashboardLevelProgress.make(from: dashboard)
    }

    var body: some View {
        DashboardCard {
            HStack(alignment: .center, spacing: XyndromeTheme.Spacing.md) {
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                    .fill(XyndromeTheme.Colors.accent.opacity(0.15))
                    .frame(width: 58, height: 58)
                    .overlay {
                        VStack(spacing: 0) {
                            Text("LV")
                                .font(XyndromeTheme.Typography.caption2())
                                .fontWeight(.semibold)
                                .foregroundStyle(XyndromeTheme.Colors.accent)
                            Text("\(level.level)")
                                .font(XyndromeTheme.Typography.title3())
                                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        }
                    }

                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Study level")
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        Spacer(minLength: XyndromeTheme.Spacing.sm)
                        Text("\(level.xp) XP")
                            .font(XyndromeTheme.Typography.caption())
                            .fontWeight(.semibold)
                            .foregroundStyle(XyndromeTheme.Colors.accent)
                    }

                    ProgressView(value: level.progress)
                        .tint(XyndromeTheme.Colors.accent)

                    Text("\(level.remainingXP) XP to level \(level.level + 1)")
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }
            }
        }
    }
}

// MARK: - Shared UI

private struct DashboardCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(XyndromeTheme.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                    .fill(XyndromeTheme.Colors.surfaceSecondary)
            )
            .overlay {
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                    .strokeBorder(XyndromeTheme.Colors.textMuted.opacity(0.08), lineWidth: 1)
            }
            .modifier(XyndromeTheme.Shadow.card())
    }
}

private struct DashboardSectionHeader: View {
    let title: String

    var body: some View {
        Text(title)
            .font(XyndromeTheme.Typography.headline())
            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
            .accessibilityAddTraits(.isHeader)
    }
}

private struct DashboardInlineAction: View {
    let title: String
    let icon: String

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.xs) {
            Text(title)
                .font(XyndromeTheme.Typography.subheadline())
                .fontWeight(.semibold)
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
            Spacer(minLength: 0)
        }
        .foregroundStyle(XyndromeTheme.Colors.primary)
        .frame(minHeight: 44, alignment: .leading)
    }
}

private struct DashboardEmptyLine: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(alignment: .top, spacing: XyndromeTheme.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(XyndromeTheme.Colors.textMuted)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                Text(title)
                    .font(XyndromeTheme.Typography.subheadline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                Text(subtitle)
                    .font(XyndromeTheme.Typography.footnote())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .lineLimit(2)
            }

            Spacer(minLength: 0)
        }
    }
}

private struct DashboardProgressRing: View {
    let progress: Double
    let tint: Color
    let size: CGFloat
    let lineWidth: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .stroke(tint.opacity(0.16), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(max(progress, 0), 1))
                .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: size, height: size)
    }
}

private struct DashboardActionDestination: View {
    let actionType: String?

    var body: some View {
        switch (actionType ?? "").lowercased() {
        case "note", "lesson":
            AiNotesListView()
        case "planner":
            StudyPlannerView()
        case "bookmark", "saved":
            BookmarksView()
        case "course":
            CoursesView()
        case "flashcard", "flashcards":
            FlashcardsLibraryView()
        default:
            QuizListView()
        }
    }
}

// MARK: - Derived Values

private struct StudyMood {
    let title: String
    let message: String
    let meter: Int
    let icon: String
    let tint: Color

    static func make(from dashboard: DashboardResponse) -> StudyMood {
        let readiness = dashboard.studyReadinessScore
        let streak = dashboard.studyStreakDays
        let attempts = dashboard.totalAttemptCount

        if readiness >= 80 {
            return StudyMood(
                title: "Exam ready pace",
                message: dashboard.performance?.readinessLabel ?? "You are holding a strong study rhythm.",
                meter: 92,
                icon: "target",
                tint: XyndromeTheme.Colors.success
            )
        }
        if streak >= 5 {
            return StudyMood(
                title: "Consistent progress",
                message: dashboard.performance?.consistencyLabel ?? "Your streak is doing real work.",
                meter: 84,
                icon: "flame.fill",
                tint: XyndromeTheme.Colors.warning
            )
        }
        if attempts >= 3 {
            return StudyMood(
                title: "Practice in progress",
                message: "Keep tightening the weak topics from your recent attempts.",
                meter: 72,
                icon: "checkmark.circle.fill",
                tint: XyndromeTheme.Colors.primary
            )
        }
        if readiness > 0 {
            return StudyMood(
                title: "Building readiness",
                message: dashboard.performance?.readinessLabel ?? "A few focused sessions will sharpen the signal.",
                meter: max(38, readiness),
                icon: "chart.line.uptrend.xyaxis",
                tint: XyndromeTheme.Colors.accent
            )
        }
        return StudyMood(
            title: "Ready to begin",
            message: "Take one short quiz to set your first baseline.",
            meter: 34,
            icon: "sparkle.magnifyingglass",
            tint: XyndromeTheme.Colors.primary
        )
    }
}

private struct DashboardLevelProgress {
    let xp: Int
    let level: Int
    let progress: Double
    let remainingXP: Int

    static func make(from dashboard: DashboardResponse) -> DashboardLevelProgress {
        let xp = dashboard.totalAttemptCount * 70
            + (dashboard.totalPassed ?? 0) * 110
            + dashboard.goalsCompletedCount * 55
            + dashboard.studyStreakDays * 35
        let level = max(1, xp / 300 + 1)
        let currentLevelXP = xp % 300
        return DashboardLevelProgress(
            xp: xp,
            level: level,
            progress: Double(currentLevelXP) / 300,
            remainingXP: 300 - currentLevelXP
        )
    }
}

private extension DashboardResponse {
    var studyReadinessScore: Int {
        if let readiness = performance?.readinessScore {
            return min(max(readiness, 0), 100)
        }
        if let avgScore {
            return min(max(Int(avgScore.rounded()), 0), 100)
        }
        if let averageScore = stats?.averageScore {
            return min(max(Int(averageScore.rounded()), 0), 100)
        }
        return 0
    }

    var studyStreakDays: Int {
        quizDayStreak ?? stats?.studyStreakDays ?? 0
    }

    var totalAttemptCount: Int {
        totalAttempts ?? stats?.quizzesCompleted ?? recentAttempts?.count ?? 0
    }

    var goalsCompletedCount: Int {
        dailyGoalsCompleted ?? goals?.filter { $0.completed == true }.count ?? 0
    }

    var averageScoreText: String {
        if let avgScore {
            return "Average \(formatPercent(avgScore))"
        }
        if let averageScore = stats?.averageScore {
            return "Average \(formatPercent(averageScore))"
        }
        return "No average yet"
    }
}

private extension CourseProgressSummary {
    var lessonSummary: String {
        if let completedLessons, let totalLessons, totalLessons > 0 {
            return "\(completedLessons)/\(totalLessons) lessons"
        }
        return sourceLabel ?? "Course lesson progress"
    }
}

private extension Collection where Element == Double {
    var average: Double? {
        guard !isEmpty else { return nil }
        return reduce(0, +) / Double(count)
    }
}

private func nonEmpty(_ value: String?) -> String? {
    guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
        return nil
    }
    return trimmed
}

private func formatPercent(_ value: Double?) -> String {
    guard let value else { return "—" }
    return "\(Int(value.rounded()))%"
}

private func shortDateLabel(_ raw: String) -> String {
    let compact = raw
        .replacingOccurrences(of: "T", with: " ")
        .replacingOccurrences(of: "Z", with: "")
    return String(compact.prefix(16))
}
