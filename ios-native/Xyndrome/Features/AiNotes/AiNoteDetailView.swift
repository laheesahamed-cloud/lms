import SwiftUI

struct AiNoteDetailView: View {
    let noteId: Int?
    let lessonId: Int?
    let engineKey: String?
    @State private var vm = AiNotesViewModel()
    @State private var showFlashcards = false
    @State private var readingProgress: Double = 0
    @State private var scrollOffset: CGFloat = 0
    @State private var contentHeight: CGFloat = 0
    @Environment(\.openURL) private var openURL

    init(noteId: Int, engineKey: String? = nil) {
        self.noteId = noteId
        self.lessonId = nil
        self.engineKey = engineKey
    }

    init(lessonId: Int, engineKey: String? = nil) {
        self.noteId = nil
        self.lessonId = lessonId
        self.engineKey = engineKey
    }

    var body: some View {
        Group {
            if vm.isDetailLoading && vm.noteDetail == nil {
                AiNoteDetailSkeleton()
            } else if let note = vm.noteDetail {
                noteContent(note)
            } else if let err = vm.error {
                ErrorView(message: err, onRetry: { Task { await vm.loadDetail(id: noteId, lessonId: lessonId, engineKey: engineKey) } })
            } else {
                LoadingView(message: "Loading lesson...")
            }
        }
        .navigationTitle(vm.noteDetail?.lessonTitle ?? vm.noteDetail?.title ?? "Lesson")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                if let videoUrl = vm.noteDetail?.videoUrl, let url = URL(string: videoUrl) {
                    Button {
                        openURL(url)
                    } label: {
                        Image(systemName: "play.rectangle")
                    }
                    .accessibilityLabel("Watch video")
                }

                if !vm.flashcards.isEmpty {
                    Button {
                        showFlashcards = true
                    } label: {
                        Image(systemName: "rectangle.on.rectangle.angled")
                    }
                    .accessibilityLabel("Open flashcards")
                }
            }
        }
        .sheet(isPresented: $showFlashcards) {
            FlashcardsView(cards: vm.flashcards)
        }
        .safeAreaInset(edge: .bottom) {
            if let note = vm.noteDetail, !note.accessLocked {
                AiNoteReadingDock(
                    note: note,
                    readingProgress: readingProgress,
                    isSaving: vm.isSavingCompletion,
                    onMarkComplete: { Task { await vm.markCurrentNoteCompleted() } }
                )
            }
        }
        .task { await vm.loadDetail(id: noteId, lessonId: lessonId, engineKey: engineKey) }
        .background(XyndromeTheme.Colors.surface)
    }

    @ViewBuilder
    private func noteContent(_ note: AiNoteDetail) -> some View {
        GeometryReader { viewport in
            ScrollView {
                GeometryReader { proxy in
                    Color.clear.preference(
                        key: AiNoteScrollOffsetPreferenceKey.self,
                        value: -proxy.frame(in: .named("aiNoteScroll")).minY
                    )
                }
                .frame(height: 0)

                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                    AiNoteDetailHeader(
                        note: note,
                        flashcardCount: vm.flashcards.count,
                        onOpenVideo: openVideo,
                        onOpenFlashcards: { showFlashcards = true }
                    )

                    if let error = vm.error {
                        Label(error, systemImage: "exclamationmark.circle.fill")
                            .font(XyndromeTheme.Typography.footnote())
                            .foregroundStyle(XyndromeTheme.Colors.error)
                            .padding(XyndromeTheme.Spacing.sm)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                    .fill(XyndromeTheme.Colors.error.opacity(0.08))
                            )
                    }

                    if note.accessLocked {
                        AiNoteLockedPanel(note: note)
                    } else if let canvas = note.canvas, !canvas.pages.isEmpty {
                        AiNoteCanvasPersonalWorkspace(note: note, page: canvas.mergedPage(note: note))
                    } else if let content = note.content, !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                            NoteContentRenderer(markdown: content)
                        }
                        .padding(XyndromeTheme.Spacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                .fill(XyndromeTheme.Colors.surfaceSecondary)
                        )
                    } else {
                        EmptyStateView(
                            icon: "note.text",
                            title: "Lesson not yet published",
                            message: "This lesson is being prepared by your instructor."
                        )
                        .frame(minHeight: 360)
                    }

                    if !vm.flashcards.isEmpty {
                        Button {
                            showFlashcards = true
                        } label: {
                            HStack(spacing: XyndromeTheme.Spacing.sm) {
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                                    .fill(XyndromeTheme.Colors.accent.opacity(0.12))
                                    .frame(width: 42, height: 42)
                                    .overlay {
                                        Image(systemName: "rectangle.on.rectangle.angled")
                                            .foregroundStyle(XyndromeTheme.Colors.accent)
                                    }

                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(vm.flashcards.count) Flashcards")
                                        .font(XyndromeTheme.Typography.headline())
                                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                                    Text("Review the approved Q&A cards for this lesson.")
                                        .font(XyndromeTheme.Typography.caption())
                                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                                }

                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
                            }
                            .padding(XyndromeTheme.Spacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                    .fill(XyndromeTheme.Colors.accent.opacity(0.08))
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(XyndromeTheme.Spacing.md)
                .padding(.bottom, 96)
                .background(
                    GeometryReader { proxy in
                        Color.clear.preference(key: AiNoteContentHeightPreferenceKey.self, value: proxy.size.height)
                    }
                )
            }
            .coordinateSpace(name: "aiNoteScroll")
            .onPreferenceChange(AiNoteScrollOffsetPreferenceKey.self) { offset in
                scrollOffset = offset
                updateReadingProgress(offset: offset, viewportHeight: viewport.size.height)
            }
            .onPreferenceChange(AiNoteContentHeightPreferenceKey.self) { height in
                contentHeight = height
                updateReadingProgress(offset: scrollOffset, viewportHeight: viewport.size.height)
            }
        }
        .background(XyndromeTheme.Colors.surface)
    }

    private func openVideo() {
        guard let videoUrl = vm.noteDetail?.videoUrl, let url = URL(string: videoUrl) else {
            return
        }
        openURL(url)
    }

    private func updateReadingProgress(offset: CGFloat, viewportHeight: CGFloat) {
        let maximumOffset = max(contentHeight - viewportHeight, 1)
        let ratio = min(1, max(0, offset / maximumOffset))
        readingProgress = Double((ratio * 100).rounded())
    }
}

private struct AiNoteDetailHeader: View {
    let note: AiNoteDetail
    let flashcardCount: Int
    let onOpenVideo: () -> Void
    let onOpenFlashcards: () -> Void

    private var title: String {
        note.lessonTitle ?? note.title
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
            HStack(alignment: .top, spacing: XyndromeTheme.Spacing.md) {
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                    .fill(XyndromeTheme.Colors.primary.opacity(0.12))
                    .frame(width: 54, height: 54)
                    .overlay {
                        Image(systemName: "brain.head.profile")
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundStyle(XyndromeTheme.Colors.primary)
                    }

                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline, spacing: XyndromeTheme.Spacing.xs) {
                        Text(title)
                            .font(XyndromeTheme.Typography.title2())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)

                        if note.isFree {
                            Text("Free")
                                .font(XyndromeTheme.Typography.caption2())
                                .fontWeight(.black)
                                .foregroundStyle(XyndromeTheme.Colors.success)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Capsule().fill(XyndromeTheme.Colors.success.opacity(0.12)))
                        }
                    }

                    if let context = note.contextLine {
                        Text(context)
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                            .lineLimit(2)
                    }
                }
            }

            if let summary = note.summary, !summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(summary)
                    .font(XyndromeTheme.Typography.subheadline())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: XyndromeTheme.Spacing.xs) {
                if note.videoUrl != nil {
                    AiNoteActionChip(title: "Video", systemImage: "play.fill", action: onOpenVideo)
                }

                if flashcardCount > 0 {
                    AiNoteActionChip(title: "\(flashcardCount) Cards", systemImage: "rectangle.on.rectangle.angled", action: onOpenFlashcards)
                }

                NavigationLink {
                    QuizListView()
                } label: {
                    Label("MCQ", systemImage: "checklist")
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.bold)
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(XyndromeTheme.Colors.surfaceTertiary))
                }
                .buttonStyle(.plain)
                .disabled(note.accessLocked)
                .opacity(note.accessLocked ? 0.45 : 1)
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

private struct AiNoteActionChip: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(XyndromeTheme.Typography.caption())
                .fontWeight(.bold)
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .padding(.horizontal, 11)
                .padding(.vertical, 8)
                .background(Capsule().fill(XyndromeTheme.Colors.surfaceTertiary))
        }
        .buttonStyle(.plain)
    }
}

private struct AiNoteLockedPanel: View {
    let note: AiNoteDetail

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.md) {
            Image(systemName: "lock.fill")
                .font(.system(size: 38, weight: .semibold))
                .foregroundStyle(XyndromeTheme.Colors.primary)

            VStack(spacing: XyndromeTheme.Spacing.xs) {
                Text(note.upgradeLabel ?? "Plan access needed")
                    .font(XyndromeTheme.Typography.headline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                Text(note.lockReason ?? "This lesson is included with selected subscriptions.")
                    .font(XyndromeTheme.Typography.subheadline())
                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            NavigationLink {
                BillingView()
            } label: {
                Text("View access options")
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .padding(XyndromeTheme.Spacing.xl)
        .frame(maxWidth: .infinity, minHeight: 360)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                        .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [8, 6]))
                        .foregroundStyle(XyndromeTheme.Colors.primary.opacity(0.22))
                )
        )
    }
}

private struct AiNoteReadingDock: View {
    let note: AiNoteDetail
    let readingProgress: Double
    let isSaving: Bool
    let onMarkComplete: () -> Void

    private var progressPercent: Double {
        min(100, max(0, note.isCompleted ? 100 : readingProgress))
    }

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.xs) {
            HStack(spacing: XyndromeTheme.Spacing.sm) {
                VStack(alignment: .leading, spacing: 5) {
                    ProgressView(value: progressPercent, total: 100)
                        .tint(note.isCompleted ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.primary)
                    Text(note.isCompleted ? "Lesson completed" : "Reading progress")
                        .font(XyndromeTheme.Typography.caption2())
                        .fontWeight(.bold)
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }

                Button(action: onMarkComplete) {
                    Text(isSaving ? "Saving..." : note.isCompleted ? "Done" : "Mark Complete")
                        .font(XyndromeTheme.Typography.caption())
                        .fontWeight(.black)
                        .foregroundStyle(note.isCompleted ? XyndromeTheme.Colors.success : .white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            Capsule()
                                .fill(note.isCompleted ? XyndromeTheme.Colors.success.opacity(0.12) : XyndromeTheme.Colors.primary)
                        )
                }
                .buttonStyle(.plain)
                .disabled(isSaving || note.isCompleted || note.lessonId == nil)
                .opacity(note.lessonId == nil ? 0.45 : 1)
            }
        }
        .padding(.horizontal, XyndromeTheme.Spacing.md)
        .padding(.vertical, XyndromeTheme.Spacing.sm)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(XyndromeTheme.Colors.textMuted.opacity(0.12))
                .frame(height: 1)
        }
    }
}

private struct AiNoteScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

private struct AiNoteContentHeightPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

private struct AiNoteDetailSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                skeletonBlock(height: 150)
                ForEach([220, 160, 190, 140], id: \.self) { height in
                    skeletonBlock(height: CGFloat(height))
                }
            }
            .padding(XyndromeTheme.Spacing.md)
        }
        .background(XyndromeTheme.Colors.surface)
        .redacted(reason: .placeholder)
    }

    private func skeletonBlock(height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
            .fill(XyndromeTheme.Colors.surfaceSecondary)
            .frame(maxWidth: .infinity)
            .frame(height: height)
    }
}
