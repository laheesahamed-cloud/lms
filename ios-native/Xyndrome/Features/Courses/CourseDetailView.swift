import SwiftUI

@Observable
@MainActor
final class CourseDetailViewModel {
    nonisolated init() {}
    var detail: CourseDetail?
    var isLoading = false
    var error: String?

    func load(id: Int) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let response: CourseDetailResponse = try await APIClient.shared.request(.studentCourseDetail(id: id))
            detail = response.course
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func markLessonComplete(_ lessonId: Int) async {
        let body = LessonProgressRequest(status: "completed", progressPercent: 100)
        try? await APIClient.shared.requestVoid(.updateLessonProgress(lessonId: lessonId), body: body)
        if let id = detail?.id {
            await load(id: id)
        }
    }
}

struct CourseDetailView: View {
    let courseId: Int
    @State private var vm = CourseDetailViewModel()

    var body: some View {
        Group {
            if vm.isLoading && vm.detail == nil {
                LoadingView(message: "Loading course...")
            } else if let err = vm.error, vm.detail == nil {
                ErrorView(message: err, onRetry: { Task { await vm.load(id: courseId) } })
            } else if let detail = vm.detail {
                courseContent(detail)
            }
        }
        .navigationTitle(vm.detail?.title ?? "Course")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load(id: courseId) }
    }

    @ViewBuilder
    private func courseContent(_ detail: CourseDetail) -> some View {
        List {
            if let desc = detail.description {
                Section {
                    Text(desc)
                        .font(XyndromeTheme.Typography.body())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }
            }

            if let progress = detail.progressPercent {
                Section {
                    VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                        HStack {
                            Text("\(Int(progress.rounded()))% complete")
                                .font(XyndromeTheme.Typography.subheadline())
                                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                            Spacer()
                            if let completed = detail.completedLessonsCount,
                               let total = detail.totalLessonsCount {
                                Text("\(completed)/\(total) lessons")
                                    .font(XyndromeTheme.Typography.caption())
                                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                            }
                        }
                        ProgressView(value: progress / 100)
                            .tint(XyndromeTheme.Colors.primary)
                    }
                }
            }

            if let subjects = detail.subjects, !subjects.isEmpty {
                ForEach(subjects) { subject in
                    Section(header: SubjectHeader(subject: subject)) {
                        ForEach(subject.topics) { topic in
                            TopicDisclosure(topic: topic, onComplete: { lessonId in
                                Task { await vm.markLessonComplete(lessonId) }
                            })
                        }
                    }
                }
            } else {
                ForEach(detail.topics ?? []) { topic in
                    Section(header: Text(topic.title)
                        .font(XyndromeTheme.Typography.headline())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    ) {
                        ForEach(topic.lessons ?? []) { lesson in
                            LessonRow(lesson: lesson, onComplete: {
                                Task { await vm.markLessonComplete(lesson.id) }
                            })
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

struct SubjectHeader: View {
    let subject: CourseSubject

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
            Text(subject.title)
                .font(XyndromeTheme.Typography.headline())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
            if let completed = subject.completedLessonsCount,
               let total = subject.totalLessonsCount {
                Text("\(completed)/\(total) lessons")
                    .font(XyndromeTheme.Typography.caption())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
            }
        }
    }
}

struct TopicDisclosure: View {
    let topic: CourseTopic
    var onComplete: (Int) -> Void

    var body: some View {
        DisclosureGroup {
            ForEach(topic.lessons ?? []) { lesson in
                LessonRow(lesson: lesson, onComplete: {
                    onComplete(lesson.id)
                })
            }
        } label: {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                HStack {
                    Text(topic.title)
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    Spacer()
                    if let progress = topic.progressPercent {
                        Text("\(Int(progress.rounded()))%")
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }
                }
                if let progress = topic.progressPercent {
                    ProgressView(value: progress / 100)
                        .tint(XyndromeTheme.Colors.primary)
                }
            }
        }
    }
}

struct LessonRow: View {
    let lesson: Lesson
    var onComplete: (() -> Void)?

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.sm) {
            NavigationLink {
                AiNoteDetailView(lessonId: lesson.id)
            } label: {
                HStack(spacing: XyndromeTheme.Spacing.sm) {
                    Image(systemName: lesson.isCompleted == true ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(lesson.isCompleted == true ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.textMuted)
                        .font(.system(size: 20))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(lesson.title)
                            .font(XyndromeTheme.Typography.subheadline())
                            .foregroundStyle(
                                lesson.isLocked == true
                                    ? XyndromeTheme.Colors.textMuted
                                    : XyndromeTheme.Colors.textPrimary
                            )
                        if let duration = lesson.duration {
                            Text("\(duration) min")
                                .font(XyndromeTheme.Typography.caption())
                                .foregroundStyle(XyndromeTheme.Colors.textMuted)
                        }
                    }

                    Spacer()

                    if lesson.isLocked == true {
                        Image(systemName: "lock.fill")
                            .foregroundStyle(XyndromeTheme.Colors.textMuted)
                            .font(.caption)
                    } else {
                        Text("Start")
                            .font(XyndromeTheme.Typography.caption())
                            .fontWeight(.bold)
                            .foregroundStyle(XyndromeTheme.Colors.primary)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if lesson.isLocked != true && lesson.isCompleted != true {
                Button("Done") {
                    onComplete?()
                }
                .font(XyndromeTheme.Typography.caption())
                .buttonStyle(.bordered)
            }
        }
        .opacity(lesson.isLocked == true ? 0.5 : 1)
    }
}
