import SwiftUI
import UIKit

@Observable
@MainActor
final class BookmarksViewModel {
    nonisolated init() {}
    var bookmarks: [Bookmark] = []
    var isLoading = false
    var error: String?

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let response: BookmarksResponse = try await APIClient.shared.request(.listBookmarks)
            bookmarks = response.bookmarks ?? []
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func remove(_ bookmark: Bookmark) async {
        let previous = bookmarks
        bookmarks.removeAll { $0.itemType == bookmark.itemType && $0.itemId == bookmark.itemId }
        do {
            let body = ToggleBookmarkRequest(itemType: bookmark.itemType, itemId: bookmark.itemId)
            let _: ToggleBookmarkResponse = try await APIClient.shared.request(.toggleBookmark, body: body)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch let e as APIError {
            bookmarks = previous
            error = e.errorDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        } catch {
            bookmarks = previous
            self.error = error.localizedDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }
}

private enum BookmarkFilter: String, CaseIterable, Identifiable {
    case all
    case quiz
    case exam
    case question
    case note

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: return "All"
        case .quiz: return "Quizzes"
        case .exam: return "Exams"
        case .question: return "Questions"
        case .note: return "Notes"
        }
    }
}

struct BookmarksView: View {
    @State private var vm = BookmarksViewModel()
    @State private var filter: BookmarkFilter = .all

    private var visibleBookmarks: [Bookmark] {
        vm.bookmarks.filter { bookmark in
            switch filter {
            case .all:
                return true
            case .quiz:
                return bookmark.itemType == "quiz" && !bookmark.isExam
            case .exam:
                return bookmark.isExam
            case .question:
                return bookmark.itemType == "question"
            case .note:
                return bookmark.isNote
            }
        }
    }

    var body: some View {
        Group {
            if vm.isLoading && vm.bookmarks.isEmpty {
                LoadingView(message: "Loading saved items...")
            } else if let err = vm.error, vm.bookmarks.isEmpty {
                ErrorView(message: err, onRetry: { Task { await vm.load() } })
            } else if vm.bookmarks.isEmpty {
                EmptyStateView(
                    icon: "bookmark",
                    title: "No Saved Items",
                    message: "Bookmark notes, questions, quizzes, or exams when you want to review them again."
                )
            } else {
                List {
                    Section {
                        BookmarkSummaryGrid(bookmarks: vm.bookmarks)
                            .listRowInsets(EdgeInsets(
                                top: XyndromeTheme.Spacing.xs,
                                leading: XyndromeTheme.Spacing.md,
                                bottom: XyndromeTheme.Spacing.xs,
                                trailing: XyndromeTheme.Spacing.md
                            ))
                            .listRowBackground(Color.clear)
                    }

                    Section {
                        Picker("Saved item type", selection: $filter) {
                            ForEach(BookmarkFilter.allCases) { option in
                                Text(option.title).tag(option)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                    .listRowBackground(Color.clear)

                    if visibleBookmarks.isEmpty {
                        Section {
                            EmptyStateView(
                                icon: "line.3.horizontal.decrease.circle",
                                title: "Nothing Here",
                                message: "Try another saved item filter."
                            )
                            .frame(minHeight: 260)
                        }
                        .listRowBackground(Color.clear)
                    } else {
                        Section {
                            ForEach(visibleBookmarks) { bookmark in
                                NavigationLink {
                                    bookmarkDestination(bookmark)
                                } label: {
                                    BookmarkRow(bookmark: bookmark)
                                }
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        Task { await vm.remove(bookmark) }
                                    } label: {
                                        Label("Remove", systemImage: "trash")
                                    }
                                }
                            }
                        } header: {
                            Text(filter.title)
                        } footer: {
                            if let error = vm.error {
                                Label(error, systemImage: "exclamationmark.circle.fill")
                                    .foregroundStyle(XyndromeTheme.Colors.error)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .background(XyndromeTheme.Colors.surface)
            }
        }
        .navigationTitle("Saved")
        .navigationBarTitleDisplayMode(.large)
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    @ViewBuilder
    private func bookmarkDestination(_ bookmark: Bookmark) -> some View {
        if bookmark.itemType == "quiz" {
            PracticeQuizView(quizId: bookmark.itemId, mode: bookmark.isExam ? .exam : .practice)
        } else if bookmark.itemType == "question", let quizId = bookmark.quizId {
            PracticeQuizView(quizId: quizId, mode: .practice)
        } else if bookmark.isNote {
            AiNoteDetailView(noteId: bookmark.itemId, engineKey: bookmark.engineKey)
        } else {
            QuizListView()
        }
    }
}

struct BookmarkSummaryGrid: View {
    let bookmarks: [Bookmark]

    private var stats: [(String, Int, String, Color)] {
        [
            ("Saved", bookmarks.count, "bookmark.fill", XyndromeTheme.Colors.primary),
            ("Quizzes", bookmarks.filter { $0.itemType == "quiz" && !$0.isExam }.count, "checkmark.circle.fill", XyndromeTheme.Colors.accent),
            ("Exams", bookmarks.filter(\.isExam).count, "timer", XyndromeTheme.Colors.warning),
            ("Notes", bookmarks.filter(\.isNote).count, "note.text", XyndromeTheme.Colors.success)
        ]
    }

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: XyndromeTheme.Spacing.sm) {
            ForEach(stats, id: \.0) { stat in
                HStack(spacing: XyndromeTheme.Spacing.sm) {
                    Image(systemName: stat.2)
                        .foregroundStyle(stat.3)
                        .frame(width: 28, height: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(stat.1)")
                            .font(XyndromeTheme.Typography.title3())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        Text(stat.0)
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(XyndromeTheme.Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .fill(XyndromeTheme.Colors.surfaceSecondary)
                )
            }
        }
    }
}

struct BookmarkRow: View {
    let bookmark: Bookmark

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.md) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(rowColor.opacity(0.14))
                .frame(width: 48, height: 48)
                .overlay {
                    Image(systemName: rowIcon)
                        .foregroundStyle(rowColor)
                }

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    Text(bookmark.displayType)
                        .font(XyndromeTheme.Typography.caption2())
                        .fontWeight(.semibold)
                        .foregroundStyle(rowColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(rowColor.opacity(0.12)))

                    if let savedAt = formattedSavedDate(bookmark.createdAt) {
                        Text(savedAt)
                            .font(XyndromeTheme.Typography.caption2())
                            .foregroundStyle(XyndromeTheme.Colors.textMuted)
                    }
                }

                Text(bookmark.displayTitle)
                    .font(XyndromeTheme.Typography.subheadline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .lineLimit(2)

                if let context = bookmark.contextLine {
                    Text(context)
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        .lineLimit(1)
                }
            }

            Spacer()
        }
        .padding(.vertical, XyndromeTheme.Spacing.xs)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(bookmark.displayType), \(bookmark.displayTitle)")
        .accessibilityHint(bookmark.actionLabel)
    }

    private var rowIcon: String {
        if bookmark.isExam { return "timer" }
        if bookmark.itemType == "quiz" { return "checkmark.circle" }
        if bookmark.itemType == "question" { return "questionmark.circle" }
        return "note.text"
    }

    private var rowColor: Color {
        if bookmark.isExam { return XyndromeTheme.Colors.warning }
        if bookmark.itemType == "quiz" || bookmark.itemType == "question" { return XyndromeTheme.Colors.accent }
        return XyndromeTheme.Colors.success
    }

    private func formattedSavedDate(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = isoFormatter.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
        guard let date else { return nil }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}
