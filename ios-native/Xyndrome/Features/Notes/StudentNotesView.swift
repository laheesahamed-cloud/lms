import SwiftUI
import UIKit

@Observable
@MainActor
final class StudentNotesViewModel {
    nonisolated init() {}
    var lessons: [LessonNotebook] = []
    var activeLessonId: Int?
    var activeLesson: LessonNotebook?
    var annotations: [LessonAnnotation] = []
    var composer = LessonNoteComposer.empty
    var expandedCourses: Set<String> = []
    var expandedTopics: Set<String> = []
    var isLoading = false
    var isDetailLoading = false
    var isSaving = false
    var deletingAnnotationId: Int?
    var error: String?

    var activeLessonSummary: LessonNotebook? {
        lessons.first { $0.id == activeLessonId } ?? lessons.first
    }

    var noteAnnotations: [LessonAnnotation] {
        annotations.filter(\.isNote)
    }

    var plainLessonText: String {
        NotebookTextTools.plainText(from: activeLesson?.lessonContent ?? "")
    }

    var paragraphs: [LessonNotebookParagraph] {
        NotebookTextTools.paragraphs(from: plainLessonText)
    }

    var lessonOutline: [LessonNotebookOutlineItem] {
        NotebookTextTools.outline(from: paragraphs)
    }

    func load(initialLessonId: Int? = nil) async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            lessons = try await StudentNotesNativeAPI.listLessons()
            expandLoadedGroups()

            let requestedLesson = initialLessonId.flatMap { id in lessons.first { $0.id == id } }
            let firstOpenLesson = lessons.first { !$0.accessLocked && $0.canAccess }
            let nextLesson = requestedLesson?.accessLocked == false && requestedLesson?.canAccess != false
                ? requestedLesson
                : firstOpenLesson ?? lessons.first

            activeLessonId = nextLesson?.id
            if let nextLesson {
                await selectLesson(nextLesson.id)
            }
        } catch {
            self.error = describe(error, fallback: "Unable to load notebook lessons")
        }
    }

    func selectLesson(_ lessonId: Int) async {
        guard activeLessonId != lessonId || activeLesson == nil else { return }
        activeLessonId = lessonId
        composer = .empty

        guard let summary = lessons.first(where: { $0.id == lessonId }) else {
            activeLesson = nil
            annotations = []
            error = "Select a lesson to open notebook view."
            return
        }

        expandAround(summary)

        guard !summary.accessLocked, summary.canAccess else {
            activeLesson = nil
            annotations = []
            error = summary.lockReason ?? "Your subscription does not include this premium lesson."
            return
        }

        isDetailLoading = true
        error = nil
        defer { isDetailLoading = false }

        do {
            async let detail = StudentNotesNativeAPI.getLesson(id: lessonId)
            async let noteRows = StudentNotesNativeAPI.listAnnotations(lessonId: lessonId)
            activeLesson = try await detail
            annotations = try await noteRows

            let body = RecordActivityRequest(activityType: "lesson_viewed", itemId: lessonId, eventType: nil)
            try? await APIClient.shared.requestVoid(.recordActivity, body: body)
        } catch {
            activeLesson = nil
            annotations = []
            self.error = describe(error, fallback: "Unable to load notebook lesson")
        }
    }

    func captureSelection(_ selection: LessonTextSelection) {
        composer = LessonNoteComposer(
            mode: .create,
            annotationId: nil,
            selectedText: selection.selectedText,
            startOffset: selection.startOffset,
            endOffset: selection.endOffset,
            noteText: ""
        )
        error = nil
    }

    func editAnnotation(_ annotation: LessonAnnotation) {
        composer = LessonNoteComposer(
            mode: .edit,
            annotationId: annotation.id,
            selectedText: annotation.selectedText,
            startOffset: annotation.startOffset,
            endOffset: annotation.endOffset,
            noteText: annotation.noteText
        )
        error = nil
    }

    func clearComposer() {
        composer = .empty
    }

    func saveNote() async {
        guard let activeLessonId else { return }

        let noteText = composer.noteText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !noteText.isEmpty else {
            error = "Note text is required before saving."
            return
        }

        isSaving = true
        defer { isSaving = false }

        do {
            if composer.isEditing, let annotationId = composer.annotationId {
                let request = UpdateLessonAnnotationRequest(color: "#c7d2fe", noteText: noteText)
                try await StudentNotesNativeAPI.updateAnnotation(
                    lessonId: activeLessonId,
                    annotationId: annotationId,
                    request: request
                )
            } else {
                guard
                    let startOffset = composer.startOffset,
                    let endOffset = composer.endOffset,
                    !composer.selectedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                else {
                    error = "Select text from the notebook before creating a note."
                    return
                }

                let request = CreateLessonAnnotationRequest(
                    type: "note",
                    selectedText: composer.selectedText,
                    startOffset: startOffset,
                    endOffset: endOffset,
                    color: "#c7d2fe",
                    noteText: noteText
                )
                try await StudentNotesNativeAPI.createAnnotation(lessonId: activeLessonId, request: request)
            }

            annotations = try await StudentNotesNativeAPI.listAnnotations(lessonId: activeLessonId)
            composer = .empty
            error = nil
        } catch {
            self.error = describe(error, fallback: "Unable to save note")
        }
    }

    func deleteAnnotation(_ annotation: LessonAnnotation) async {
        guard let activeLessonId else { return }
        deletingAnnotationId = annotation.id
        defer { deletingAnnotationId = nil }

        do {
            try await StudentNotesNativeAPI.deleteAnnotation(lessonId: activeLessonId, annotationId: annotation.id)
            annotations = try await StudentNotesNativeAPI.listAnnotations(lessonId: activeLessonId)
            if composer.annotationId == annotation.id {
                composer = .empty
            }
            error = nil
        } catch {
            self.error = describe(error, fallback: "Unable to delete note")
        }
    }

    func toggleCourse(_ courseId: String) {
        if expandedCourses.contains(courseId) {
            expandedCourses.remove(courseId)
        } else {
            expandedCourses.insert(courseId)
        }
    }

    func toggleTopic(_ topicId: String) {
        if expandedTopics.contains(topicId) {
            expandedTopics.remove(topicId)
        } else {
            expandedTopics.insert(topicId)
        }
    }

    private func expandLoadedGroups() {
        let groups = LessonNotebookGrouping.courses(from: lessons)
        expandedCourses.formUnion(groups.map(\.id))
        expandedTopics.formUnion(groups.flatMap { $0.topics.map(\.id) })
    }

    private func expandAround(_ lesson: LessonNotebook) {
        let courseId = lesson.courseTitle.notebookTrimmed ?? "General"
        let topicId = "\(courseId)::\(lesson.topicName.notebookTrimmed ?? "General topic")"
        expandedCourses.insert(courseId)
        expandedTopics.insert(topicId)
    }

    private func describe(_ error: Error, fallback: String) -> String {
        if let apiError = error as? APIError {
            return apiError.errorDescription ?? fallback
        }
        return error.localizedDescription.isEmpty ? fallback : error.localizedDescription
    }
}

struct StudentNotesView: View {
    let initialLessonId: Int?
    @State private var vm = StudentNotesViewModel()
    @State private var studyMode = true
    @State private var outlineOpen = true
    @State private var recallMode = false
    @State private var readerDensity: NotebookReaderDensity = .comfort
    @State private var libraryOpen = false
    @State private var revealedBlocks: Set<Int> = []
    @State private var pendingDelete: LessonAnnotation?
    @Environment(\.openURL) private var openURL

    init(initialLessonId: Int? = nil) {
        self.initialLessonId = initialLessonId
    }

    private var courseGroups: [LessonNotebookCourseGroup] {
        LessonNotebookGrouping.courses(from: vm.lessons)
    }

    private var activeVideoUrl: String? {
        (vm.activeLesson?.videoUrl ?? vm.activeLessonSummary?.videoUrl).notebookTrimmed
    }

    var body: some View {
        Group {
            if vm.isLoading && vm.lessons.isEmpty {
                LoadingView(message: "Loading lessons...")
            } else if let error = vm.error, vm.lessons.isEmpty {
                ErrorView(message: error, onRetry: { Task { await vm.load(initialLessonId: initialLessonId) } })
            } else if vm.lessons.isEmpty {
                EmptyStateView(
                    icon: "note.text",
                    title: "No active lessons yet",
                    message: "Your lesson notebooks will appear here once active lessons are available."
                )
            } else {
                notesContent
            }
        }
        .navigationTitle("Notes")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                Button {
                    libraryOpen = true
                } label: {
                    Image(systemName: "books.vertical")
                }
                .accessibilityLabel("Lesson Notebooks")

                if let activeVideoUrl, let url = URL(string: activeVideoUrl) {
                    Button {
                        openURL(url)
                    } label: {
                        Image(systemName: "play.rectangle")
                    }
                    .accessibilityLabel("Watch Video")
                }
            }
        }
        .sheet(isPresented: $libraryOpen) {
            NavigationStack {
                LessonNotebookLibraryView(
                    groups: courseGroups,
                    activeLessonId: vm.activeLessonId,
                    expandedCourses: vm.expandedCourses,
                    expandedTopics: vm.expandedTopics,
                    onToggleCourse: vm.toggleCourse,
                    onToggleTopic: vm.toggleTopic,
                    onSelectLesson: { lessonId in
                        libraryOpen = false
                        Task { await vm.selectLesson(lessonId) }
                    }
                )
                .navigationTitle("Lesson notebooks")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close") { libraryOpen = false }
                    }
                }
            }
            .presentationDetents([.medium, .large])
        }
        .confirmationDialog(
            "Delete this note?",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                guard let pendingDelete else { return }
                Task {
                    await vm.deleteAnnotation(pendingDelete)
                    self.pendingDelete = nil
                }
            }
            Button("Cancel", role: .cancel) {
                pendingDelete = nil
            }
        }
        .task {
            await vm.load(initialLessonId: initialLessonId)
        }
        .onChange(of: vm.activeLessonId) { _, _ in
            revealedBlocks.removeAll()
        }
        .onChange(of: recallMode) { _, _ in
            revealedBlocks.removeAll()
        }
        .background(XyndromeTheme.Colors.surface)
    }

    private var notesContent: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                    LessonNotebookHeader(
                        lesson: vm.activeLesson ?? vm.activeLessonSummary,
                        lessonCount: vm.lessons.count,
                        noteCount: vm.noteAnnotations.count
                    )

                    if let error = vm.error {
                        LessonNotebookFeedback(message: error)
                    }

                    LessonNotebookModeBar(
                        studyMode: $studyMode,
                        onOpenLibrary: { libraryOpen = true },
                        onOpenVideo: openVideo,
                        hasVideo: activeVideoUrl != nil
                    )

                    if studyMode, vm.activeLesson != nil {
                        LessonNotebookReaderToolbar(
                            outlineOpen: $outlineOpen,
                            recallMode: $recallMode,
                            density: $readerDensity
                        )
                    }

                    if studyMode, outlineOpen, !vm.lessonOutline.isEmpty {
                        LessonNotebookOutlineRail(outline: vm.lessonOutline) { index in
                            withAnimation(.easeInOut(duration: 0.24)) {
                                proxy.scrollTo(NotebookTextTools.blockId(index), anchor: .top)
                            }
                            if recallMode {
                                revealedBlocks.insert(index)
                            }
                        }
                    }

                    if vm.isDetailLoading {
                        LessonNotebookLoadingCard()
                    } else if let summary = vm.activeLessonSummary,
                              summary.accessLocked || !summary.canAccess {
                        LessonNotebookLockedCard(message: summary.lockReason ?? "This lesson is included with selected subscriptions.")
                    } else if vm.activeLesson != nil {
                        if studyMode {
                            LessonStudyReader(
                                paragraphs: vm.paragraphs,
                                annotations: vm.annotations,
                                recallMode: recallMode,
                                density: readerDensity,
                                revealedBlocks: $revealedBlocks
                            )
                        } else {
                            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
                                LessonNotebookHint()
                                SelectableLessonTextView(
                                    text: vm.plainLessonText,
                                    annotations: vm.annotations,
                                    density: readerDensity,
                                    onSelection: vm.captureSelection,
                                    onAnnotationTap: { annotationId in
                                        if let annotation = vm.noteAnnotations.first(where: { $0.id == annotationId }) {
                                            vm.editAnnotation(annotation)
                                        }
                                    }
                                )
                                .frame(minHeight: 420)
                                .padding(XyndromeTheme.Spacing.md)
                                .background(
                                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                        .fill(XyndromeTheme.Colors.surfaceSecondary)
                                )
                            }

                            LessonNoteComposerView(composer: $vm.composer, isSaving: vm.isSaving) {
                                Task { await vm.saveNote() }
                            } onClear: {
                                vm.clearComposer()
                            }

                            LessonAnnotationListView(
                                annotations: vm.noteAnnotations,
                                deletingAnnotationId: vm.deletingAnnotationId,
                                onEdit: vm.editAnnotation,
                                onDelete: { annotation in pendingDelete = annotation }
                            )
                        }
                    } else {
                        EmptyStateView(
                            icon: "note.text",
                            title: "Select a lesson",
                            message: "Choose a lesson notebook to open the reader."
                        )
                        .frame(minHeight: 320)
                    }
                }
                .padding(XyndromeTheme.Spacing.md)
                .padding(.bottom, XyndromeTheme.Spacing.xl)
            }
            .background(XyndromeTheme.Colors.surface)
        }
    }

    private func openVideo() {
        guard let activeVideoUrl, let url = URL(string: activeVideoUrl) else { return }
        openURL(url)
    }
}

private struct LessonNotebookHeader: View {
    let lesson: LessonNotebook?
    let lessonCount: Int
    let noteCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
            HStack(alignment: .top, spacing: XyndromeTheme.Spacing.md) {
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                    .fill(XyndromeTheme.Colors.primary.opacity(0.12))
                    .frame(width: 54, height: 54)
                    .overlay {
                        Image(systemName: "note.text")
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundStyle(XyndromeTheme.Colors.primary)
                    }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Study Notebook")
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.black)
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                        .textCase(.uppercase)

                    Text(lesson?.lessonTitle ?? "Notes")
                        .font(XyndromeTheme.Typography.title2())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)

                    if let context = lesson?.contextLine, !context.isEmpty {
                        Text(context)
                            .font(XyndromeTheme.Typography.footnote())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                            .lineLimit(2)
                    }
                }

                Spacer(minLength: XyndromeTheme.Spacing.sm)
            }

            HStack(spacing: XyndromeTheme.Spacing.sm) {
                LessonNotebookMetric(title: "Lesson notebooks", value: "\(lessonCount)")
                LessonNotebookMetric(title: "Saved notes", value: "\(noteCount)")
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                        .strokeBorder(XyndromeTheme.Colors.primary.opacity(0.08), lineWidth: 1)
                )
        )
    }
}

private struct LessonNotebookMetric: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(XyndromeTheme.Typography.headline())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
            Text(title)
                .font(XyndromeTheme.Typography.caption2())
                .fontWeight(.bold)
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, XyndromeTheme.Spacing.sm)
        .padding(.vertical, XyndromeTheme.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(XyndromeTheme.Colors.surfaceTertiary)
        )
    }
}

private struct LessonNotebookFeedback: View {
    let message: String

    var body: some View {
        Label(message, systemImage: "exclamationmark.circle.fill")
            .font(XyndromeTheme.Typography.footnote())
            .foregroundStyle(XyndromeTheme.Colors.error)
            .padding(XyndromeTheme.Spacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                    .fill(XyndromeTheme.Colors.error.opacity(0.08))
            )
    }
}

private struct LessonNotebookModeBar: View {
    @Binding var studyMode: Bool
    let onOpenLibrary: () -> Void
    let onOpenVideo: () -> Void
    let hasVideo: Bool

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.sm) {
            HStack(spacing: XyndromeTheme.Spacing.sm) {
                Button(action: onOpenLibrary) {
                    Label("Lesson Notebooks", systemImage: "books.vertical")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryButtonStyle())

                if hasVideo {
                    Button(action: onOpenVideo) {
                        Label("Watch Video", systemImage: "play.rectangle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
            }

            Picker("Notebook mode", selection: $studyMode) {
                Text("Study Only").tag(true)
                Text("Open Workspace").tag(false)
            }
            .pickerStyle(.segmented)
        }
    }
}

private struct LessonNotebookReaderToolbar: View {
    @Binding var outlineOpen: Bool
    @Binding var recallMode: Bool
    @Binding var density: NotebookReaderDensity

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Reader tools")
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.black)
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                        .textCase(.uppercase)
                    Text("Outline, recall tape, and reading density for focused study.")
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }
                Spacer()
            }

            HStack(spacing: XyndromeTheme.Spacing.xs) {
                NotebookToolButton(title: "Outline", systemImage: "list.bullet", isActive: outlineOpen) {
                    outlineOpen.toggle()
                }
                NotebookToolButton(title: "Recall tape", systemImage: "eye.slash", isActive: recallMode) {
                    recallMode.toggle()
                }
                NotebookToolButton(title: "Compact", systemImage: "textformat.size.smaller", isActive: density == .compact) {
                    density = density == .compact ? .comfort : .compact
                }
            }
        }
        .padding(XyndromeTheme.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
    }
}

private struct NotebookToolButton: View {
    let title: String
    let systemImage: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.black)
                .foregroundStyle(isActive ? XyndromeTheme.Colors.primary : XyndromeTheme.Colors.textSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .fill(isActive ? XyndromeTheme.Colors.primary.opacity(0.1) : XyndromeTheme.Colors.surfaceTertiary)
                )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isActive ? .isSelected : [])
    }
}

private struct LessonNotebookOutlineRail: View {
    let outline: [LessonNotebookOutlineItem]
    let onSelect: (Int) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: XyndromeTheme.Spacing.xs) {
                ForEach(outline) { item in
                    Button {
                        onSelect(item.index)
                    } label: {
                        Text(item.title)
                            .font(XyndromeTheme.Typography.caption())
                            .fontWeight(.black)
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                            .lineLimit(1)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 9)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                    .fill(XyndromeTheme.Colors.surfaceTertiary)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(8)
        }
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
    }
}

private struct LessonStudyReader: View {
    let paragraphs: [LessonNotebookParagraph]
    let annotations: [LessonAnnotation]
    let recallMode: Bool
    let density: NotebookReaderDensity
    @Binding var revealedBlocks: Set<Int>

    var body: some View {
        VStack(alignment: .leading, spacing: density.paragraphSpacing) {
            ForEach(paragraphs) { paragraph in
                Button {
                    guard recallMode else { return }
                    if revealedBlocks.contains(paragraph.index) {
                        revealedBlocks.remove(paragraph.index)
                    } else {
                        revealedBlocks.insert(paragraph.index)
                    }
                } label: {
                    paragraphBody(paragraph)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .id(NotebookTextTools.blockId(paragraph.index))
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
    }

    @ViewBuilder
    private func paragraphBody(_ paragraph: LessonNotebookParagraph) -> some View {
        if recallMode && !revealedBlocks.contains(paragraph.index) {
            Text("Tap to reveal")
                .font(.system(size: 12, weight: .black))
                .foregroundStyle(XyndromeTheme.Colors.textMuted)
                .textCase(.uppercase)
                .frame(maxWidth: .infinity, minHeight: density.hiddenBlockHeight, alignment: .leading)
                .padding(.horizontal, XyndromeTheme.Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .fill(XyndromeTheme.Colors.warning.opacity(0.09))
                        .overlay(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                .strokeBorder(XyndromeTheme.Colors.warning.opacity(0.18), lineWidth: 1)
                        )
                )
        } else {
            Text(NotebookTextStyler.attributedParagraph(paragraph, annotations: annotations, density: density))
                .font(.system(size: density.fontSize))
                .lineSpacing(density.lineSpacing)
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                .textSelection(.enabled)
        }
    }
}

private struct LessonNotebookHint: View {
    var body: some View {
        Text("How to use: select text in the notebook, then write your note in the editor panel.")
            .font(XyndromeTheme.Typography.footnote())
            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
            .padding(XyndromeTheme.Spacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                    .fill(XyndromeTheme.Colors.surfaceSecondary)
            )
    }
}

private struct LessonNoteComposerView: View {
    @Binding var composer: LessonNoteComposer
    let isSaving: Bool
    let onSave: () -> Void
    let onClear: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(composer.isEditing ? "Edit note" : "Create note")
                        .font(XyndromeTheme.Typography.headline())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    Text(composer.isEditing ? "Update Existing" : "New Note")
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.black)
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                        .textCase(.uppercase)
                }
                Spacer()
            }

            Text(composer.selectedText.isEmpty ? "No text selected yet" : "Selected lesson text")
                .font(XyndromeTheme.Typography.subheadline())
                .fontWeight(.semibold)
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)

            Text(composer.selectedText.isEmpty ? "Highlight text from the notebook viewer to prepare a new note." : composer.selectedText)
                .font(XyndromeTheme.Typography.footnote())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                .padding(XyndromeTheme.Spacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .fill(XyndromeTheme.Colors.surfaceTertiary)
                )

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                Text("Your note")
                    .font(XyndromeTheme.Typography.footnote())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)

                TextEditor(text: $composer.noteText)
                    .frame(minHeight: 150)
                    .padding(8)
                    .scrollContentBackground(.hidden)
                    .background(
                        RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                            .fill(XyndromeTheme.Colors.surfaceTertiary)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                            .strokeBorder(XyndromeTheme.Colors.textMuted.opacity(0.12), lineWidth: 1)
                    )
            }

            HStack(spacing: XyndromeTheme.Spacing.sm) {
                Button(isSaving ? "Saving..." : composer.isEditing ? "Update Note" : "Save Note", action: onSave)
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(isSaving)

                Button("Clear", action: onClear)
                    .buttonStyle(SecondaryButtonStyle())
                    .disabled(isSaving)
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
    }
}

private struct LessonAnnotationListView: View {
    let annotations: [LessonAnnotation]
    let deletingAnnotationId: Int?
    let onEdit: (LessonAnnotation) -> Void
    let onDelete: (LessonAnnotation) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            HStack {
                Text("\(annotations.count) saved note(s) for this lesson")
                    .font(XyndromeTheme.Typography.headline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                Spacer()
            }

            if annotations.isEmpty {
                Text("No notes yet. Select text and save your first one.")
                    .font(XyndromeTheme.Typography.footnote())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .padding(XyndromeTheme.Spacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                            .fill(XyndromeTheme.Colors.surfaceSecondary)
                    )
            } else {
                ForEach(annotations) { annotation in
                    LessonAnnotationCard(
                        annotation: annotation,
                        isDeleting: deletingAnnotationId == annotation.id,
                        onEdit: { onEdit(annotation) },
                        onDelete: { onDelete(annotation) }
                    )
                }
            }
        }
    }
}

private struct LessonAnnotationCard: View {
    let annotation: LessonAnnotation
    let isDeleting: Bool
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            HStack {
                Text("Note")
                    .font(XyndromeTheme.Typography.caption2())
                    .fontWeight(.bold)
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(XyndromeTheme.Colors.surfaceTertiary))
                Spacer()
                Text("\(annotation.selectedText.count) chars linked")
                    .font(XyndromeTheme.Typography.caption2())
                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
            }

            Text("\"\(annotation.selectedText)\"")
                .font(XyndromeTheme.Typography.footnote())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                .padding(XyndromeTheme.Spacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .fill(XyndromeTheme.Colors.surfaceTertiary)
                )

            Text(annotation.noteText.isEmpty ? "No note text added." : annotation.noteText)
                .font(XyndromeTheme.Typography.footnote())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: XyndromeTheme.Spacing.xs) {
                Button(action: onEdit) {
                    Image(systemName: "pencil")
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("Edit note")

                Button(role: .destructive, action: onDelete) {
                    Image(systemName: isDeleting ? "hourglass" : "trash")
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.bordered)
                .disabled(isDeleting)
                .accessibilityLabel("Delete note")
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
    }
}

private struct LessonNotebookLibraryView: View {
    let groups: [LessonNotebookCourseGroup]
    let activeLessonId: Int?
    let expandedCourses: Set<String>
    let expandedTopics: Set<String>
    let onToggleCourse: (String) -> Void
    let onToggleTopic: (String) -> Void
    let onSelectLesson: (Int) -> Void

    var body: some View {
        List {
            if groups.isEmpty {
                Text("No active lessons yet.")
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
            } else {
                ForEach(groups) { course in
                    Section {
                        Button {
                            onToggleCourse(course.id)
                        } label: {
                            LessonNotebookDisclosureRow(
                                title: course.title,
                                subtitle: "\(course.topics.count) topic(s)",
                                isExpanded: expandedCourses.contains(course.id)
                            )
                        }
                        .buttonStyle(.plain)

                        if expandedCourses.contains(course.id) {
                            ForEach(course.topics) { topic in
                                Button {
                                    onToggleTopic(topic.id)
                                } label: {
                                    LessonNotebookDisclosureRow(
                                        title: topic.title,
                                        subtitle: "\(topic.lessons.count) notebook(s)",
                                        isExpanded: expandedTopics.contains(topic.id)
                                    )
                                    .padding(.leading, XyndromeTheme.Spacing.md)
                                }
                                .buttonStyle(.plain)

                                if expandedTopics.contains(topic.id) {
                                    ForEach(topic.lessons) { lesson in
                                        LessonNotebookLessonButton(
                                            lesson: lesson,
                                            isSelected: activeLessonId == lesson.id,
                                            onSelect: { onSelectLesson(lesson.id) }
                                        )
                                        .padding(.leading, XyndromeTheme.Spacing.lg)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(XyndromeTheme.Colors.surface)
    }
}

private struct LessonNotebookDisclosureRow: View {
    let title: String
    let subtitle: String
    let isExpanded: Bool

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.sm) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(XyndromeTheme.Typography.subheadline())
                    .fontWeight(.semibold)
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                Text(subtitle)
                    .font(XyndromeTheme.Typography.caption())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
            }
            Spacer()
            Image(systemName: isExpanded ? "minus.circle.fill" : "plus.circle.fill")
                .foregroundStyle(XyndromeTheme.Colors.textMuted)
        }
        .padding(.vertical, XyndromeTheme.Spacing.xs)
    }
}

private struct LessonNotebookLessonButton: View {
    let lesson: LessonNotebook
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: XyndromeTheme.Spacing.sm) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(lesson.displayTitle)
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(lesson.accessLocked ? XyndromeTheme.Colors.textMuted : XyndromeTheme.Colors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 5) {
                        if lesson.isFree {
                            Text("Free lesson")
                                .font(XyndromeTheme.Typography.caption2())
                                .fontWeight(.black)
                                .foregroundStyle(XyndromeTheme.Colors.success)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(Capsule().fill(XyndromeTheme.Colors.success.opacity(0.12)))
                        }
                        Text(lesson.accessLocked ? "Included with selected plans" : lesson.lessonTitle)
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                if lesson.accessLocked {
                    Image(systemName: "lock.fill")
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)
                } else if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(XyndromeTheme.Colors.primary)
                }
            }
            .padding(XyndromeTheme.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                    .fill(isSelected ? XyndromeTheme.Colors.primary.opacity(0.1) : XyndromeTheme.Colors.surfaceSecondary)
            )
        }
        .buttonStyle(.plain)
        .opacity(lesson.accessLocked ? 0.72 : 1)
    }
}

private struct LessonNotebookLoadingCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(XyndromeTheme.Colors.surfaceTertiary)
                .frame(height: 22)
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(XyndromeTheme.Colors.surfaceTertiary)
                .frame(height: 180)
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
        .redacted(reason: .placeholder)
    }
}

private struct LessonNotebookLockedCard: View {
    let message: String

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.md) {
            Image(systemName: "lock.fill")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(XyndromeTheme.Colors.primary)
            Text(message)
                .font(XyndromeTheme.Typography.subheadline())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            NavigationLink {
                BillingView()
            } label: {
                Text("View access options")
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .padding(XyndromeTheme.Spacing.xl)
        .frame(maxWidth: .infinity, minHeight: 320)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
    }
}

private struct SelectableLessonTextView: UIViewRepresentable {
    let text: String
    let annotations: [LessonAnnotation]
    let density: NotebookReaderDensity
    let onSelection: (LessonTextSelection) -> Void
    let onAnnotationTap: (Int) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelection: onSelection, onAnnotationTap: onAnnotationTap)
    }

    func makeUIView(context: Context) -> UITextView {
        let textView = UITextView()
        textView.delegate = context.coordinator
        textView.isEditable = false
        textView.isSelectable = true
        textView.isScrollEnabled = false
        textView.backgroundColor = .clear
        textView.textContainerInset = .zero
        textView.textContainer.lineFragmentPadding = 0
        textView.adjustsFontForContentSizeCategory = true
        textView.linkTextAttributes = [
            .foregroundColor: UIColor.label,
            .underlineStyle: NSUnderlineStyle.single.rawValue,
        ]
        return textView
    }

    func updateUIView(_ textView: UITextView, context: Context) {
        context.coordinator.onSelection = onSelection
        context.coordinator.onAnnotationTap = onAnnotationTap
        textView.attributedText = NotebookTextStyler.attributedText(text, annotations: annotations, density: density)
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        let width = proposal.width ?? UIScreen.main.bounds.width - 32
        let size = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: max(420, size.height))
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var onSelection: (LessonTextSelection) -> Void
        var onAnnotationTap: (Int) -> Void

        init(onSelection: @escaping (LessonTextSelection) -> Void, onAnnotationTap: @escaping (Int) -> Void) {
            self.onSelection = onSelection
            self.onAnnotationTap = onAnnotationTap
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            let range = textView.selectedRange
            guard range.length > 0, range.location != NSNotFound else { return }
            let nsText = textView.text as NSString
            guard range.upperBound <= nsText.length else { return }
            let selected = nsText.substring(with: range).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !selected.isEmpty else { return }

            onSelection(
                LessonTextSelection(
                    selectedText: selected,
                    startOffset: range.location,
                    endOffset: range.location + range.length
                )
            )
        }

        func textView(_ textView: UITextView, primaryActionFor textItem: UITextItem, defaultAction: UIAction) -> UIAction? {
            guard case .link(let url) = textItem.content,
                  url.scheme == "xyndrome-note",
                  let id = Int(url.host ?? url.lastPathComponent) else {
                return defaultAction
            }

            return UIAction { [weak self] _ in
                self?.onAnnotationTap(id)
            }
        }
    }
}

private enum NotebookReaderDensity: String {
    case comfort
    case compact

    var fontSize: CGFloat {
        switch self {
        case .comfort: return 17
        case .compact: return 15
        }
    }

    var lineSpacing: CGFloat {
        switch self {
        case .comfort: return 8
        case .compact: return 5
        }
    }

    var paragraphSpacing: CGFloat {
        switch self {
        case .comfort: return 18
        case .compact: return 12
        }
    }

    var hiddenBlockHeight: CGFloat {
        switch self {
        case .comfort: return 54
        case .compact: return 42
        }
    }
}

private struct LessonNotebookCourseGroup: Identifiable {
    let id: String
    let title: String
    let topics: [LessonNotebookTopicGroup]
}

private struct LessonNotebookTopicGroup: Identifiable {
    let id: String
    let title: String
    let lessons: [LessonNotebook]
}

private enum LessonNotebookGrouping {
    static func courses(from lessons: [LessonNotebook]) -> [LessonNotebookCourseGroup] {
        let courseBuckets = Dictionary(grouping: lessons) { lesson in
            lesson.courseTitle.notebookTrimmed ?? "General"
        }

        return courseBuckets.keys.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }.map { courseTitle in
            let courseLessons = courseBuckets[courseTitle] ?? []
            let topicBuckets = Dictionary(grouping: courseLessons) { lesson in
                lesson.topicName.notebookTrimmed ?? "General topic"
            }

            let topics = topicBuckets.keys.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }.map { topicTitle in
                LessonNotebookTopicGroup(
                    id: "\(courseTitle)::\(topicTitle)",
                    title: topicTitle,
                    lessons: (topicBuckets[topicTitle] ?? []).sorted(by: lessonSort)
                )
            }

            return LessonNotebookCourseGroup(id: courseTitle, title: courseTitle, topics: topics)
        }
    }

    private static func lessonSort(lhs: LessonNotebook, rhs: LessonNotebook) -> Bool {
        if lhs.accessLocked != rhs.accessLocked {
            return !lhs.accessLocked
        }
        return lhs.displayTitle.localizedCaseInsensitiveCompare(rhs.displayTitle) == .orderedAscending
    }
}

struct LessonNotebookParagraph: Identifiable {
    let index: Int
    let text: String
    let range: NSRange

    var id: Int { index }
}

struct LessonNotebookOutlineItem: Identifiable {
    let index: Int
    let title: String

    var id: Int { index }
}

private enum NotebookTextTools {
    static func blockId(_ index: Int) -> String {
        "note-block-\(index)"
    }

    static func plainText(from content: String) -> String {
        var text = String(content)
        text = text.replacingOccurrences(of: #"<br\s*/?>"#, with: "\n", options: .regularExpression)
        text = text.replacingOccurrences(of: #"</p>"#, with: "\n\n", options: [.regularExpression, .caseInsensitive])
        text = text.replacingOccurrences(of: #"<[^>]+>"#, with: " ", options: .regularExpression)
        text = text.replacingOccurrences(of: "\u{00a0}", with: " ")
        text = text.replacingOccurrences(of: #"[ \t]+\n"#, with: "\n", options: .regularExpression)
        text = text.replacingOccurrences(of: #"\n{3,}"#, with: "\n\n", options: .regularExpression)
        text = text.replacingOccurrences(of: #"[ \t]{2,}"#, with: " ", options: .regularExpression)
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func paragraphs(from plainText: String) -> [LessonNotebookParagraph] {
        let text = plainText.isEmpty ? "No lesson content has been added yet." : plainText
        let nsText = text as NSString
        guard let regex = try? NSRegularExpression(pattern: #"\n{2,}"#) else {
            return [LessonNotebookParagraph(index: 0, text: text, range: NSRange(location: 0, length: nsText.length))]
        }

        let matches = regex.matches(in: text, range: NSRange(location: 0, length: nsText.length))
        var result: [LessonNotebookParagraph] = []
        var cursor = 0

        for match in matches {
            if match.range.location > cursor {
                let range = NSRange(location: cursor, length: match.range.location - cursor)
                result.append(LessonNotebookParagraph(index: result.count, text: nsText.substring(with: range), range: range))
            }
            cursor = match.range.location + match.range.length
        }

        if cursor < nsText.length {
            let range = NSRange(location: cursor, length: nsText.length - cursor)
            result.append(LessonNotebookParagraph(index: result.count, text: nsText.substring(with: range), range: range))
        }

        return result.isEmpty
            ? [LessonNotebookParagraph(index: 0, text: text, range: NSRange(location: 0, length: nsText.length))]
            : result
    }

    static func outline(from paragraphs: [LessonNotebookParagraph]) -> [LessonNotebookOutlineItem] {
        paragraphs.compactMap { paragraph in
            let title = paragraph.text.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard isLikelyOutlineTitle(title, index: paragraph.index) else { return nil }
            return LessonNotebookOutlineItem(index: paragraph.index, title: title)
        }
        .prefix(10)
        .map { $0 }
    }

    private static func isLikelyOutlineTitle(_ text: String, index: Int) -> Bool {
        guard !text.isEmpty else { return false }
        if index == 0 { return true }
        if text.count > 82 { return false }
        if let last = text.last, ".:;!?".contains(last) { return false }
        if text.range(
            of: #"^(definition|overview|classification|causes?|risk factors?|pathophysiology|clinical features?|symptoms?|signs?|diagnosis|investigations?|management|treatment|complications?|summary|key points?|exam points?|remember)\b"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil {
            return true
        }

        let words = text.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        if words.count > 9 { return false }
        let importantWords = words.filter { word in
            guard let scalar = word.unicodeScalars.first else { return false }
            return CharacterSet.uppercaseLetters.contains(scalar)
                || CharacterSet.decimalDigits.contains(scalar)
                || word.count > 7
        }.count
        return importantWords >= max(1, Int(ceil(Double(words.count) * 0.45)))
    }
}

private enum NotebookTextStyler {
    static func attributedText(_ text: String, annotations: [LessonAnnotation], density: NotebookReaderDensity) -> NSAttributedString {
        let displayText = text.isEmpty ? "No lesson content has been added yet." : text
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = density.lineSpacing
        paragraphStyle.paragraphSpacing = density.paragraphSpacing

        let attributed = NSMutableAttributedString(
            string: displayText,
            attributes: [
                .font: UIFont.systemFont(ofSize: density.fontSize),
                .foregroundColor: UIColor.label,
                .paragraphStyle: paragraphStyle,
            ]
        )

        applyAnnotations(annotations, to: attributed, baseLocation: 0)
        return attributed
    }

    static func attributedParagraph(
        _ paragraph: LessonNotebookParagraph,
        annotations: [LessonAnnotation],
        density: NotebookReaderDensity
    ) -> AttributedString {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = density.lineSpacing

        let attributed = NSMutableAttributedString(
            string: paragraph.text,
            attributes: [
                .font: UIFont.systemFont(ofSize: density.fontSize),
                .foregroundColor: UIColor.label,
                .paragraphStyle: paragraphStyle,
            ]
        )

        applyAnnotations(annotations, to: attributed, baseLocation: paragraph.range.location)
        return AttributedString(attributed)
    }

    private static func applyAnnotations(_ annotations: [LessonAnnotation], to attributed: NSMutableAttributedString, baseLocation: Int) {
        let textLength = attributed.length
        for annotation in annotations.sorted(by: { $0.startOffset < $1.startOffset }) {
            let localStart = max(0, annotation.startOffset - baseLocation)
            let localEnd = min(textLength, annotation.endOffset - baseLocation)
            guard localEnd > localStart else { continue }
            let range = NSRange(location: localStart, length: localEnd - localStart)
            attributed.addAttribute(.backgroundColor, value: annotationColor(annotation).withAlphaComponent(0.62), range: range)
            attributed.addAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue, range: range)
            attributed.addAttribute(.underlineColor, value: annotationUnderlineColor(annotation), range: range)

            if annotation.isNote, let url = URL(string: "xyndrome-note://\(annotation.id)") {
                attributed.addAttribute(.link, value: url, range: range)
            }
        }
    }

    private static func annotationColor(_ annotation: LessonAnnotation) -> UIColor {
        if let safe = UIColor(notebookHex: annotation.color) {
            return safe
        }
        return annotation.isNote ? UIColor(red: 0.78, green: 0.82, blue: 1, alpha: 1) : UIColor(red: 1, green: 0.96, blue: 0.62, alpha: 1)
    }

    private static func annotationUnderlineColor(_ annotation: LessonAnnotation) -> UIColor {
        annotation.isNote ? UIColor.systemIndigo.withAlphaComponent(0.38) : UIColor.systemYellow.withAlphaComponent(0.5)
    }
}

private extension UIColor {
    convenience init?(notebookHex: String) {
        let hex = notebookHex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        guard hex.count == 6, let value = UInt64(hex, radix: 16) else { return nil }
        self.init(
            red: CGFloat((value >> 16) & 0xff) / 255,
            green: CGFloat((value >> 8) & 0xff) / 255,
            blue: CGFloat(value & 0xff) / 255,
            alpha: 1
        )
    }
}

private extension NSRange {
    var upperBound: Int {
        location + length
    }
}

private extension Optional where Wrapped == String {
    var notebookTrimmed: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }
}
