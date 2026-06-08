import Foundation
import SwiftUI
import UIKit

extension Notification.Name {
    static let aiLessonProgressUpdated = Notification.Name("aiLessonProgressUpdated")
}

enum AiNotesNativeAPI {
    static let engines = ["gemini", "openai"]

    @MainActor
    static func listNotes() async throws -> [AiNote] {
        var merged: [AiNote] = []
        var firstError: APIError?

        for engine in engines {
            do {
                let response: AiNotesListResponse = try await APIClient.shared.request(
                    .listAiNotes,
                    queryItems: [URLQueryItem(name: "engine", value: engine)]
                )
                let responseEngine = response.engine ?? engine
                merged.append(contentsOf: response.notes.map { $0.withFallbackEngine(responseEngine) })
            } catch let error as APIError {
                if error.isUnauthorized { throw error }
                if firstError == nil { firstError = error }
            } catch {
                if firstError == nil { firstError = .unknown(error) }
            }
        }

        let unique = merged.reduce(into: [String: AiNote]()) { result, note in
            result[note.engineScopedId] = note
        }
        let notes = Array(unique.values).sorted { lhs, rhs in
            let left = [lhs.courseTitle, lhs.topicName, lhs.lessonTitle, lhs.title, lhs.engineKey].compactMap { $0 }.joined(separator: " ")
            let right = [rhs.courseTitle, rhs.topicName, rhs.lessonTitle, rhs.title, rhs.engineKey].compactMap { $0 }.joined(separator: " ")
            return left.localizedCaseInsensitiveCompare(right) == .orderedAscending
        }

        if notes.isEmpty, let firstError {
            throw firstError
        }
        return notes
    }

    @MainActor
    static func getNote(id: Int, preferredEngine: String?) async throws -> AiNoteDetailResponse {
        let engineOrder = ([preferredEngine].compactMap { $0 } + engines)
            .reduce(into: [String]()) { result, engine in
                if !result.contains(engine) { result.append(engine) }
            }
        var lastError: APIError?

        for engine in engineOrder {
            do {
                return try await APIClient.shared.request(
                    .getAiNote(id: id),
                    queryItems: [URLQueryItem(name: "engine", value: engine)]
                )
            } catch let error as APIError {
                if error.isUnauthorized { throw error }
                if case .notFound = error {
                    lastError = error
                    continue
                }
                throw error
            } catch {
                lastError = .unknown(error)
            }
        }

        throw lastError ?? APIError.notFound
    }

    @MainActor
    static func getLessonNote(lessonId: Int, preferredEngine: String?) async throws -> AiNoteDetailResponse {
        let engineOrder = ([preferredEngine].compactMap { $0 } + engines)
            .reduce(into: [String]()) { result, engine in
                if !result.contains(engine) { result.append(engine) }
            }
        var lastError: APIError?

        for engine in engineOrder {
            do {
                return try await APIClient.shared.request(
                    .getLessonAiNote(lessonId: lessonId),
                    queryItems: [URLQueryItem(name: "engine", value: engine)]
                )
            } catch let error as APIError {
                if error.isUnauthorized { throw error }
                if case .notFound = error {
                    lastError = error
                    continue
                }
                throw error
            } catch {
                lastError = .unknown(error)
            }
        }

        throw lastError ?? APIError.notFound
    }

    @MainActor
    static func recordAiNoteViewed(itemId: Int?) async {
        let body = RecordActivityRequest(
            activityType: "ai_note_viewed",
            itemId: itemId,
            eventType: nil
        )
        try? await APIClient.shared.requestVoid(.recordActivity, body: body)
    }

    @MainActor
    static func bookmarkedNoteIds() async throws -> Set<Int> {
        let response: BookmarksResponse = try await APIClient.shared.request(.listBookmarks)
        let ids = (response.bookmarks ?? [])
            .filter { $0.isNote }
            .map(\.itemId)
        return Set(ids)
    }

    @MainActor
    static func toggleBookmark(noteId: Int) async throws -> Bool? {
        let body = ToggleBookmarkRequest(itemType: "ai_note", itemId: noteId)
        let response: ToggleBookmarkResponse = try await APIClient.shared.request(.toggleBookmark, body: body)
        return response.isSaved
    }
}

@Observable
@MainActor
final class AiNotesViewModel {
    nonisolated init() {}
    var notes: [AiNote] = []
    var bookmarkedNoteIds: Set<Int> = []
    var noteDetail: AiNoteDetail?
    var flashcards: [Flashcard] = []
    var isLoading = false
    var isDetailLoading = false
    var isSavingCompletion = false
    var error: String?

    func loadList() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            notes = try await AiNotesNativeAPI.listNotes()
            bookmarkedNoteIds = (try? await AiNotesNativeAPI.bookmarkedNoteIds()) ?? bookmarkedNoteIds
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadDetail(id: Int? = nil, lessonId: Int? = nil, engineKey: String? = nil) async {
        isDetailLoading = true
        error = nil
        defer { isDetailLoading = false }
        do {
            let response: AiNoteDetailResponse
            if let lessonId {
                response = try await AiNotesNativeAPI.getLessonNote(lessonId: lessonId, preferredEngine: engineKey)
            } else if let id {
                response = try await AiNotesNativeAPI.getNote(id: id, preferredEngine: engineKey)
            } else {
                throw APIError.notFound
            }
            noteDetail = response.note
            flashcards = response.flashcards
            await AiNotesNativeAPI.recordAiNoteViewed(itemId: response.note.id > 0 ? response.note.id : id ?? lessonId)
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func toggleBookmark(noteId: Int) async {
        let wasSaved = bookmarkedNoteIds.contains(noteId)
        if wasSaved {
            bookmarkedNoteIds.remove(noteId)
        } else {
            bookmarkedNoteIds.insert(noteId)
        }

        do {
            if let saved = try await AiNotesNativeAPI.toggleBookmark(noteId: noteId) {
                if saved {
                    bookmarkedNoteIds.insert(noteId)
                } else {
                    bookmarkedNoteIds.remove(noteId)
                }
            }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch let e as APIError {
            if wasSaved {
                bookmarkedNoteIds.insert(noteId)
            } else {
                bookmarkedNoteIds.remove(noteId)
            }
            error = e.errorDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        } catch {
            if wasSaved {
                bookmarkedNoteIds.insert(noteId)
            } else {
                bookmarkedNoteIds.remove(noteId)
            }
            self.error = error.localizedDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }

    func markCurrentNoteCompleted() async {
        guard let noteDetail, let lessonId = noteDetail.lessonId else {
            error = "This lesson is not linked to course progress yet."
            return
        }
        isSavingCompletion = true
        error = nil
        defer { isSavingCompletion = false }
        do {
            let body = LessonProgressRequest(status: "completed", progressPercent: 100)
            try await APIClient.shared.requestVoid(.updateLessonProgress(lessonId: lessonId), body: body)
            self.noteDetail = noteDetail.markingCompleted()
            NotificationCenter.default.post(
                name: .aiLessonProgressUpdated,
                object: nil,
                userInfo: [
                    "lessonId": lessonId,
                    "noteId": noteDetail.id,
                    "progressPercent": 100,
                    "status": "completed"
                ]
            )
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch let e as APIError {
            error = e.errorDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        } catch {
            self.error = error.localizedDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }
}

struct AiNotesCourseGroup: Identifiable {
    let title: String
    let subjects: [AiNotesSubjectGroup]

    var id: String { title }

    var lessonCount: Int {
        subjects.reduce(0) { $0 + $1.notes.count }
    }
}

struct AiNotesSubjectGroup: Identifiable {
    let title: String
    let notes: [AiNote]

    var id: String { title }
}

private enum AiNotesGrouping {
    static func courses(from notes: [AiNote]) -> [AiNotesCourseGroup] {
        let courseBuckets = Dictionary(grouping: notes, by: \.courseKey)
        return courseBuckets.keys.sorted { lhs, rhs in
            if lhs == "General" { return false }
            if rhs == "General" { return true }
            return lhs.localizedCaseInsensitiveCompare(rhs) == .orderedAscending
        }.map { courseTitle in
            let courseNotes = courseBuckets[courseTitle] ?? []
            let subjectBuckets = Dictionary(grouping: courseNotes, by: \.subjectKey)
            let subjects = subjectBuckets.keys.sorted { lhs, rhs in
                if lhs == "General" { return false }
                if rhs == "General" { return true }
                return lhs.localizedCaseInsensitiveCompare(rhs) == .orderedAscending
            }.map { subjectTitle in
                AiNotesSubjectGroup(
                    title: subjectTitle,
                    notes: (subjectBuckets[subjectTitle] ?? []).sorted(by: lessonSort)
                )
            }
            return AiNotesCourseGroup(title: courseTitle, subjects: subjects)
        }
    }

    private static func lessonSort(_ lhs: AiNote, _ rhs: AiNote) -> Bool {
        let left = lhs.lessonTitle ?? lhs.title
        let right = rhs.lessonTitle ?? rhs.title
        return left.localizedStandardCompare(right) == .orderedAscending
    }
}

struct AiNotesListView: View {
    @State private var vm = AiNotesViewModel()
    @State private var selectedCourse: AiNotesCourseGroup?
    @Environment(\.horizontalSizeClass) var sizeClass

    private var courseGroups: [AiNotesCourseGroup] {
        AiNotesGrouping.courses(from: vm.notes)
    }

    var body: some View {
        Group {
            if vm.isLoading && vm.notes.isEmpty {
                AiNotesHubSkeleton()
            } else if let err = vm.error, vm.notes.isEmpty {
                ErrorView(message: err, onRetry: { Task { await vm.loadList() } })
            } else if vm.notes.isEmpty {
                EmptyStateView(
                    icon: "note.text",
                    title: "No Lessons Yet",
                    message: "Lessons will appear here once published by your instructor."
                )
            } else if let selectedCourse {
                AiNotesCourseDetailView(
                    course: selectedCourse,
                    bookmarkedNoteIds: vm.bookmarkedNoteIds,
                    onBack: { self.selectedCourse = nil },
                    onBookmark: { noteId in
                        Task { await vm.toggleBookmark(noteId: noteId) }
                    }
                )
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.lg) {
                        AiNotesHubHeader(courseCount: courseGroups.count, lessonCount: vm.notes.count)
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 280), spacing: XyndromeTheme.Spacing.md)],
                            spacing: XyndromeTheme.Spacing.md
                        ) {
                            ForEach(courseGroups) { course in
                                Button {
                                    withAnimation(.easeOut(duration: 0.18)) {
                                        selectedCourse = course
                                    }
                                } label: {
                                    AiNotesCourseCard(course: course)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(pagePadding(sizeClass))
                    .padding(.bottom, XyndromeTheme.Spacing.xl)
                    .pageFrame()
                }
                .background(XyndromeTheme.Colors.surface)
            }
        }
        .background(XyndromeTheme.Colors.surface)
        .navigationTitle(selectedCourse?.title ?? "Lessons")
        .navigationBarTitleDisplayMode(.large)
        .task { await vm.loadList() }
        .refreshable { await vm.loadList() }
        .onReceive(NotificationCenter.default.publisher(for: .aiLessonProgressUpdated)) { notification in
            let lessonId = notification.userInfo?["lessonId"] as? Int
            let noteId = notification.userInfo?["noteId"] as? Int
            guard lessonId != nil || noteId != nil else { return }
            vm.notes = vm.notes.map { note in
                let matchesLesson = lessonId.map { note.lessonId == $0 } ?? false
                let matchesNote = noteId.map { note.id == $0 } ?? false
                return matchesLesson || matchesNote ? note.markingCompleted() : note
            }
        }
    }
}

private struct AiNotesHubHeader: View {
    let courseCount: Int
    let lessonCount: Int

    var body: some View {
        HStack(alignment: .center, spacing: XyndromeTheme.Spacing.md) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(XyndromeTheme.Colors.primary.opacity(0.12))
                .frame(width: 54, height: 54)
                .overlay {
                    Image(systemName: "stethoscope")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                }

            VStack(alignment: .leading, spacing: 4) {
                Text("Choose a Lesson")
                    .font(XyndromeTheme.Typography.title3())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .textCase(.uppercase)
                Text("\(lessonCount) lesson\(lessonCount == 1 ? "" : "s") available")
                    .font(XyndromeTheme.Typography.footnote())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
            }

            Spacer()

            Text("\(courseCount) \(courseCount == 1 ? "course" : "courses")")
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.bold)
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Capsule().fill(XyndromeTheme.Colors.surfaceSecondary))
        }
    }
}

private struct AiNotesCourseCard: View {
    let course: AiNotesCourseGroup

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.lg) {
            HStack(alignment: .top, spacing: XyndromeTheme.Spacing.md) {
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                    .fill(XyndromeTheme.Colors.primary.opacity(0.12))
                    .frame(width: 46, height: 46)
                    .overlay {
                        Image(systemName: "book.pages")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(XyndromeTheme.Colors.primary)
                    }

                VStack(alignment: .leading, spacing: 5) {
                    Text(course.title)
                        .font(XyndromeTheme.Typography.headline())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Text("\(course.subjects.count) subject\(course.subjects.count == 1 ? "" : "s")")
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)
                }

                Spacer(minLength: 0)
            }

            HStack(alignment: .lastTextBaseline) {
                Text("\(course.lessonCount)")
                    .font(.system(size: 34, weight: .black, design: .rounded))
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                Text("lessons")
                    .font(XyndromeTheme.Typography.caption())
                    .fontWeight(.black)
                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
                    .textCase(.uppercase)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: 136, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .strokeBorder(XyndromeTheme.Colors.primary.opacity(0.08), lineWidth: 1)
                )
        )
        .modifier(XyndromeTheme.Shadow.card())
        .contentShape(RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md))
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}

private struct AiNotesCourseDetailView: View {
    let course: AiNotesCourseGroup
    let bookmarkedNoteIds: Set<Int>
    let onBack: () -> Void
    let onBookmark: (Int) -> Void

    @State private var activeSubject: String?
    @State private var collapsedSubjects: Set<String> = []

    private var visibleSubjects: [AiNotesSubjectGroup] {
        guard let activeSubject else {
            return course.subjects
        }
        return course.subjects.filter { $0.title == activeSubject }
    }

    private var visibleLessonCount: Int {
        visibleSubjects.reduce(0) { $0 + $1.notes.count }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                toolbar
                subjectFilter
                subjectList
            }
            .padding(XyndromeTheme.Spacing.md)
            .padding(.bottom, XyndromeTheme.Spacing.xl)
        }
        .background(XyndromeTheme.Colors.surface)
        .onChange(of: course.id) { _, _ in
            activeSubject = nil
            collapsedSubjects = []
        }
    }

    private var toolbar: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            HStack(spacing: XyndromeTheme.Spacing.sm) {
                Button(action: onBack) {
                    Label("Back", systemImage: "chevron.left")
                        .labelStyle(.titleAndIcon)
                }
                .font(XyndromeTheme.Typography.subheadline())
                .fontWeight(.semibold)
                .buttonStyle(.bordered)

                Spacer()

                Text("\(visibleLessonCount) \(visibleLessonCount == 1 ? "Lesson" : "Lessons")")
                    .font(XyndromeTheme.Typography.caption())
                    .fontWeight(.bold)
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(XyndromeTheme.Colors.surfaceSecondary))
            }

            Text(course.title)
                .font(XyndromeTheme.Typography.title2())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
        }
    }

    @ViewBuilder
    private var subjectFilter: some View {
        if course.subjects.count > 1 {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    AiNotesFilterChip(title: "All subjects", isActive: activeSubject == nil) {
                        activeSubject = nil
                    }

                    ForEach(course.subjects) { subject in
                        AiNotesFilterChip(title: subject.title, isActive: activeSubject == subject.title) {
                            activeSubject = activeSubject == subject.title ? nil : subject.title
                        }
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private var subjectList: some View {
        VStack(spacing: XyndromeTheme.Spacing.md) {
            ForEach(visibleSubjects) { subject in
                let isCollapsed = collapsedSubjects.contains(subject.id)
                AiNotesSubjectSection(
                    subject: subject,
                    isCollapsed: isCollapsed,
                    bookmarkedNoteIds: bookmarkedNoteIds,
                    onToggleCollapse: {
                        if isCollapsed {
                            collapsedSubjects.remove(subject.id)
                        } else {
                            collapsedSubjects.insert(subject.id)
                        }
                    },
                    onBookmark: onBookmark
                )
            }
        }
    }
}

private struct AiNotesFilterChip: View {
    let title: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.bold)
                .foregroundStyle(isActive ? .white : XyndromeTheme.Colors.textSecondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(isActive ? XyndromeTheme.Colors.primary : XyndromeTheme.Colors.surfaceSecondary)
                )
        }
        .buttonStyle(.plain)
    }
}

private struct AiNotesSubjectSection: View {
    let subject: AiNotesSubjectGroup
    let isCollapsed: Bool
    let bookmarkedNoteIds: Set<Int>
    let onToggleCollapse: () -> Void
    let onBookmark: (Int) -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button(action: onToggleCollapse) {
                HStack(spacing: XyndromeTheme.Spacing.sm) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(subject.title)
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        Text("\(subject.notes.count) \(subject.notes.count == 1 ? "lesson" : "lessons")")
                            .font(XyndromeTheme.Typography.caption())
                            .fontWeight(.semibold)
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)
                        .rotationEffect(.degrees(isCollapsed ? -90 : 0))
                }
                .padding(XyndromeTheme.Spacing.md)
            }
            .buttonStyle(.plain)

            if !isCollapsed {
                VStack(spacing: XyndromeTheme.Spacing.xs) {
                    ForEach(Array(subject.notes.enumerated()), id: \.element.engineScopedId) { index, note in
                        HStack(spacing: XyndromeTheme.Spacing.sm) {
                            NavigationLink {
                                AiNoteDetailView(noteId: note.id, engineKey: note.engineKey)
                            } label: {
                                AiNoteLessonRowView(note: note, index: index)
                            }
                            .buttonStyle(.plain)

                            AiNoteBookmarkButton(
                                isSaved: bookmarkedNoteIds.contains(note.id),
                                onBookmark: { onBookmark(note.id) }
                            )
                        }
                        .padding(.vertical, 10)
                        .padding(.horizontal, XyndromeTheme.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                .fill(note.isCompleted ? XyndromeTheme.Colors.success.opacity(0.08) : XyndromeTheme.Colors.surface)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                .strokeBorder(note.isCompleted ? XyndromeTheme.Colors.success.opacity(0.16) : Color.clear, lineWidth: 1)
                        )
                    }
                }
                .padding(.horizontal, XyndromeTheme.Spacing.sm)
                .padding(.bottom, XyndromeTheme.Spacing.sm)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .strokeBorder(XyndromeTheme.Colors.primary.opacity(0.08), lineWidth: 1)
        )
    }
}

struct AiNoteLessonRowView: View {
    let note: AiNote
    let index: Int

    var body: some View {
        HStack(alignment: .center, spacing: XyndromeTheme.Spacing.sm) {
            Text(String(format: "%02d.", index + 1))
                .font(.system(size: 13, weight: .black, design: .rounded))
                .foregroundStyle(XyndromeTheme.Colors.textMuted)
                .frame(width: 34, alignment: .leading)

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    Text(note.lessonTitle ?? note.title)
                        .font(XyndromeTheme.Typography.subheadline())
                        .fontWeight(.semibold)
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .lineLimit(2)

                    if note.isCompleted {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(XyndromeTheme.Colors.success)
                            .accessibilityLabel("Completed")
                    }
                }

                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    if note.accessLocked {
                        Text("Locked")
                            .foregroundStyle(XyndromeTheme.Colors.warning)
                    } else if note.isFree {
                        Text("Free lesson")
                            .foregroundStyle(XyndromeTheme.Colors.success)
                    } else if let context = note.subtopicName ?? note.summary {
                        Text(context)
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                            .lineLimit(1)
                    }

                    if note.flashcardTotal > 0 {
                        Label("\(note.flashcardTotal)", systemImage: "rectangle.on.rectangle.angled")
                            .foregroundStyle(XyndromeTheme.Colors.accent)
                    }
                }
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.semibold)
            }

            Spacer(minLength: XyndromeTheme.Spacing.xs)

            Text("Start")
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.bold)
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    Capsule().fill(note.accessLocked ? XyndromeTheme.Colors.textMuted : XyndromeTheme.Colors.primary)
                )
        }
        .accessibilityElement(children: .combine)
    }
}

private struct AiNoteBookmarkButton: View {
    let isSaved: Bool
    let onBookmark: () -> Void

    var body: some View {
        Button(action: onBookmark) {
            Label(isSaved ? "Saved" : "Save", systemImage: isSaved ? "checkmark" : "bookmark")
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.bold)
                .labelStyle(.titleAndIcon)
                .foregroundStyle(isSaved ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.textSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(
                    Capsule().fill(isSaved ? XyndromeTheme.Colors.success.opacity(0.12) : XyndromeTheme.Colors.surfaceTertiary)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isSaved ? "Saved lesson" : "Save lesson")
    }
}

private struct AiNotesHubSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.lg) {
                HStack(spacing: XyndromeTheme.Spacing.md) {
                    skeletonBlock(width: 54, height: 54, radius: XyndromeTheme.Radius.lg)
                    VStack(alignment: .leading, spacing: 8) {
                        skeletonBlock(width: 170, height: 18, radius: 6)
                        skeletonBlock(width: 120, height: 12, radius: 5)
                    }
                    Spacer()
                }

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: XyndromeTheme.Spacing.md)], spacing: XyndromeTheme.Spacing.md) {
                    ForEach(0..<6, id: \.self) { _ in
                        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.lg) {
                            HStack {
                                skeletonBlock(width: 46, height: 46, radius: XyndromeTheme.Radius.md)
                                VStack(alignment: .leading, spacing: 8) {
                                    skeletonBlock(width: 150, height: 14, radius: 5)
                                    skeletonBlock(width: 84, height: 11, radius: 4)
                                }
                                Spacer()
                            }
                            skeletonBlock(width: 104, height: 30, radius: 8)
                        }
                        .padding(XyndromeTheme.Spacing.md)
                        .frame(maxWidth: .infinity, minHeight: 136, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                .fill(XyndromeTheme.Colors.surfaceSecondary)
                        )
                    }
                }
            }
            .padding(XyndromeTheme.Spacing.md)
        }
        .background(XyndromeTheme.Colors.surface)
    }

    private func skeletonBlock(width: CGFloat, height: CGFloat, radius: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: radius)
            .fill(XyndromeTheme.Colors.surfaceTertiary)
            .frame(width: width, height: height)
            .redacted(reason: .placeholder)
    }
}

struct NoteRowView: View {
    let note: AiNote

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.md) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(XyndromeTheme.Colors.accent.opacity(0.15))
                .frame(width: 48, height: 48)
                .overlay {
                    Image(systemName: "brain.head.profile")
                        .foregroundStyle(XyndromeTheme.Colors.accent)
                }

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                Text(note.title)
                    .font(XyndromeTheme.Typography.headline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .lineLimit(2)

                if let context = note.lessonTitle ?? note.subjectArea ?? note.topicName {
                    Text(context)
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(
                            Capsule().fill(XyndromeTheme.Colors.primary.opacity(0.1))
                        )
                }

                if let summary = note.summary {
                    Text(summary)
                        .font(XyndromeTheme.Typography.footnote())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        .lineLimit(2)
                }

                HStack(spacing: XyndromeTheme.Spacing.sm) {
                    if note.flashcardTotal > 0 {
                        Label("\(note.flashcardTotal) cards", systemImage: "rectangle.on.rectangle.angled")
                    }
                    if note.accessLocked {
                        Label("Locked", systemImage: "lock.fill")
                    }
                }
                .font(XyndromeTheme.Typography.caption())
                .foregroundStyle(note.accessLocked ? XyndromeTheme.Colors.warning : XyndromeTheme.Colors.textMuted)
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
