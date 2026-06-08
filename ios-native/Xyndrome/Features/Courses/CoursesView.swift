import SwiftUI

@Observable
@MainActor
final class CoursesViewModel {
    nonisolated init() {}
    var courses: [Course] = []
    var isLoading = false
    var error: String?

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let response: CoursesResponse = try await APIClient.shared.request(.studentCourses)
            courses = response.courses ?? []
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct CoursesView: View {
    @State private var vm = CoursesViewModel()
    @Environment(\.horizontalSizeClass) var sizeClass

    var body: some View {
        VStack(spacing: 0) {
            RootTabHeader(title: "Courses")

            Group {
                if vm.isLoading && vm.courses.isEmpty {
                    LoadingView(message: "Loading courses...")
                } else if let err = vm.error, vm.courses.isEmpty {
                    ErrorView(message: err, onRetry: { Task { await vm.load() } })
                } else if vm.courses.isEmpty {
                    EmptyStateView(
                        icon: "books.vertical",
                        title: "No Courses Yet",
                        message: "Your enrolled courses will appear here."
                    )
                } else if sizeClass == .regular {
                    // Grid layout on iPad / Mac
                    ScrollView {
                        LazyVGrid(
                            columns: adaptiveColumns(compact: 2, regular: 3, sizeClass: sizeClass),
                            spacing: XyndromeTheme.Spacing.md
                        ) {
                            ForEach(vm.courses) { course in
                                NavigationLink(value: course.id) {
                                    CourseRowView(course: course)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(pagePadding(sizeClass))
                        .pageFrame()
                    }
                    .background(XyndromeTheme.Colors.surface)
                } else {
                    List(vm.courses) { course in
                        NavigationLink(value: course.id) {
                            CourseRowView(course: course)
                        }
                        .listRowInsets(EdgeInsets(
                            top: XyndromeTheme.Spacing.xs,
                            leading: XyndromeTheme.Spacing.md,
                            bottom: XyndromeTheme.Spacing.xs,
                            trailing: XyndromeTheme.Spacing.md
                        ))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                    .contentMargins(.top, 0, for: .scrollContent)
                    .background(XyndromeTheme.Colors.surface)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(XyndromeTheme.Colors.surface)
        .navigationTitle("Courses")
        .navigationBarTitleDisplayMode(sizeClass == .regular ? .large : .inline)
        .toolbar(sizeClass == .regular ? .visible : .hidden, for: .navigationBar)
        .navigationDestination(for: Int.self) { courseId in
            CourseDetailView(courseId: courseId)
        }
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }
}

struct CourseRowView: View {
    let course: Course

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.md) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(XyndromeTheme.Colors.primary.opacity(0.15))
                .frame(width: 56, height: 56)
                .overlay {
                    Image(systemName: "book.fill")
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                }

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                Text(course.title)
                    .font(XyndromeTheme.Typography.headline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .lineLimit(2)

                if let lessons = course.lessonsCount {
                    Text("\(course.completedLessons ?? 0) of \(lessons) lessons")
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }

                if let progress = course.progressPercent {
                    ProgressView(value: progress / 100)
                        .tint(XyndromeTheme.Colors.primary)
                        .frame(height: 4)
                }
            }

            Spacer()
        }
        .padding(XyndromeTheme.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
        .modifier(XyndromeTheme.Shadow.card())
    }
}
