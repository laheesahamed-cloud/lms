import Foundation
import SwiftUI

@Observable
@MainActor
final class QuizViewModel {
    nonisolated init() {}
    var quizzes: [QuizSummary] = []
    var quizData: QuizLoadResponse?
    var currentAnswers: [Int: QuizAnswerValue] = [:]
    var currentQuestionIndex = 0
    var isLoading = false
    var isSubmitting = false
    var error: String?
    var finishedResult: AttemptResult?
    var completedPracticeReview: PracticeReviewResponse?
    var revealedQuestions: [Int: QuizQuestion] = [:]
    var revealedQuestionIds: Set<Int> = []
    var bookmarkedQuestionIds: Set<Int> = []
    var flaggedQuestionIds: Set<Int> = []
    var questionActionBusy = false
    var reportSuccessMessage: String?
    var timeRemainingSeconds = 0
    private var timerTask: Task<Void, Never>?

    func loadList() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let response: QuizzesListResponse = try await APIClient.shared.request(.listQuizzes)
            quizzes = response.quizzes
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadQuiz(id: Int, mode: QuizMode) async {
        isLoading = true
        error = nil
        currentAnswers = [:]
        currentQuestionIndex = 0
        finishedResult = nil
        completedPracticeReview = nil
        revealedQuestions = [:]
        revealedQuestionIds = []
        bookmarkedQuestionIds = []
        flaggedQuestionIds = []
        questionActionBusy = false
        reportSuccessMessage = nil
        defer { isLoading = false }

        do {
            let response: QuizLoadResponse = try await APIClient.shared.request(
                .loadQuiz(id: id),
                queryItems: [
                    URLQueryItem(name: "mode", value: mode.rawValue),
                    URLQueryItem(name: "continue", value: "1")
                ]
            )
            quizData = response
            restoreSession(response.activeSession, questionCount: response.questions.count)
            restoreSavedPracticeAnswersIfNeeded(from: response)
            await loadQuestionBookmarks()
            if let minutes = response.metadata?.durationMinutes {
                timeRemainingSeconds = minutes * 60
            }
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func selectedSBAOption(for questionId: Int) -> Int? {
        if case .single(let optionId)? = currentAnswers[questionId] {
            return optionId
        }
        return nil
    }

    func trueFalseValue(questionId: Int, optionId: Int) -> Bool? {
        if case .trueFalse(let values)? = currentAnswers[questionId] {
            return values[String(optionId)]
        }
        return nil
    }

    func selectSBAAnswer(questionId: Int, optionId: Int, quizId: Int, mode: QuizMode) async {
        currentAnswers[questionId] = .single(optionId)
        await savePracticeAnswerIfNeeded(
            questionId: questionId,
            quizId: quizId,
            mode: mode,
            selected: [optionId],
            tfAnswers: nil
        )
        await autosave(quizId: quizId, mode: mode)
    }

    func selectTrueFalseAnswer(questionId: Int, optionId: Int, value: Bool, quizId: Int, mode: QuizMode) async {
        var answers: [String: Bool] = [:]
        if case .trueFalse(let existing)? = currentAnswers[questionId] {
            answers = existing
        }
        answers[String(optionId)] = value
        currentAnswers[questionId] = .trueFalse(answers)

        await savePracticeAnswerIfNeeded(
            questionId: questionId,
            quizId: quizId,
            mode: mode,
            selected: nil,
            tfAnswers: answers
        )
        await autosave(quizId: quizId, mode: mode)
    }

    func autosave(quizId: Int, mode: QuizMode) async {
        let answers = encodedAnswers
        do {
            if mode == .exam {
                let request = SaveExamRequest(
                    answers: answers,
                    currentQuestionIndex: currentQuestionIndex,
                    flaggedQuestionIds: Array(flaggedQuestionIds)
                )
                try await APIClient.shared.requestVoid(.saveExam(id: quizId), body: request)
            } else {
                let request = SaveDraftRequest(
                    answers: answers,
                    currentQuestionIndex: currentQuestionIndex,
                    revealedQuestionIds: Array(revealedQuestionIds)
                )
                try await APIClient.shared.requestVoid(.savePracticeDraft(id: quizId), body: request)
            }
        } catch {
            // Autosave should never interrupt fast answer tapping. The next explicit
            // action will surface a server error if the session is gone.
        }
    }

    func finishPractice(quizId: Int) async {
        isSubmitting = true
        error = nil
        defer { isSubmitting = false }
        await autosave(quizId: quizId, mode: .practice)
        do {
            let request = SaveDraftRequest(
                answers: encodedAnswers,
                currentQuestionIndex: currentQuestionIndex,
                revealedQuestionIds: Array(revealedQuestionIds)
            )
            _ = try await APIClient.shared.request(.finishPractice(id: quizId), body: request) as FinishAttemptResponse
            completedPracticeReview = try await APIClient.shared.request(
                .getPracticeReview(attemptId: quizId),
                queryItems: [URLQueryItem(name: "complete", value: "1")]
            )
            let summary = completedPracticeReview?.summary
            let percentage = summary?.percentage ?? 0
            let passingMarks = summary?.passingMarks ?? 45
            finishedResult = AttemptResult(
                id: 0,
                quizTitle: quizData?.metadata?.title,
                score: percentage,
                totalQuestions: summary?.total,
                correctAnswers: summary?.correct,
                wrongAnswers: summary?.wrong,
                unansweredQuestions: summary?.unanswered,
                passingMarks: passingMarks,
                passStatus: percentage >= passingMarks ? "pass" : "fail",
                mode: QuizMode.practice.rawValue,
                passed: percentage >= passingMarks
            )
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func submitExam(quizId: Int) async {
        isSubmitting = true
        error = nil
        timerTask?.cancel()
        defer { isSubmitting = false }
        do {
            await autosave(quizId: quizId, mode: .exam)
            let request = SubmitExamRequest(answers: encodedAnswers)
            let response: SubmitExamResponse = try await APIClient.shared.request(.submitExam(id: quizId), body: request)
            if let result = response.result, result.id > 0, result.quizTitle != nil || result.score != nil {
                finishedResult = result
                return
            }

            guard let attemptId = response.attemptId, attemptId > 0 else {
                throw APIError.serverError(0, "Exam submitted, but the server did not return a result id.")
            }

            let detail: ResultDetailResponse = try await APIClient.shared.request(.getResult(attemptId: attemptId))
            finishedResult = detail.result ?? AttemptResult(
                id: attemptId,
                quizTitle: quizData?.metadata?.title,
                mode: QuizMode.exam.rawValue
            )
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func revealPracticeAnswer(quizId: Int, questionId: Int, userInitiated: Bool = true) async {
        if revealedQuestions[questionId] != nil {
            revealedQuestionIds.insert(questionId)
            return
        }
        if userInitiated {
            questionActionBusy = true
            error = nil
        }
        defer {
            if userInitiated {
                questionActionBusy = false
            }
        }
        do {
            let response: PracticeRevealResponse = try await APIClient.shared.request(
                .revealPracticeAnswer(quizId: quizId, questionId: questionId)
            )
            revealedQuestions[questionId] = response.question
            revealedQuestionIds.insert(questionId)
            if userInitiated {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
        } catch let e as APIError {
            error = e.errorDescription
            if userInitiated {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
        } catch {
            self.error = error.localizedDescription
            if userInitiated {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
        }
    }

    func toggleFlag(questionId: Int, quizId: Int, mode: QuizMode) async {
        if flaggedQuestionIds.contains(questionId) {
            flaggedQuestionIds.remove(questionId)
        } else {
            flaggedQuestionIds.insert(questionId)
        }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if mode == .exam {
            await autosave(quizId: quizId, mode: mode)
        }
    }

    func toggleQuestionBookmark(questionId: Int) async {
        let wasSaved = bookmarkedQuestionIds.contains(questionId)
        if wasSaved {
            bookmarkedQuestionIds.remove(questionId)
        } else {
            bookmarkedQuestionIds.insert(questionId)
        }

        questionActionBusy = true
        error = nil
        defer { questionActionBusy = false }

        do {
            let request = ToggleBookmarkRequest(itemType: "question", itemId: questionId)
            let response: ToggleBookmarkResponse = try await APIClient.shared.request(.toggleBookmark, body: request)
            if let saved = response.isSaved {
                if saved {
                    bookmarkedQuestionIds.insert(questionId)
                } else {
                    bookmarkedQuestionIds.remove(questionId)
                }
            }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch let e as APIError {
            if wasSaved {
                bookmarkedQuestionIds.insert(questionId)
            } else {
                bookmarkedQuestionIds.remove(questionId)
            }
            error = e.errorDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        } catch {
            if wasSaved {
                bookmarkedQuestionIds.insert(questionId)
            } else {
                bookmarkedQuestionIds.remove(questionId)
            }
            self.error = error.localizedDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }

    func reportQuestion(questionId: Int, comment: String) async {
        questionActionBusy = true
        error = nil
        reportSuccessMessage = nil
        defer { questionActionBusy = false }

        let trimmedComment = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = QuestionReportRequest(
            questionId: questionId,
            reason: "Student reported question",
            comment: trimmedComment.isEmpty ? "Student reported question #\(questionId)" : trimmedComment
        )

        do {
            let _: QuestionReportResponse = try await APIClient.shared.request(.reportQuestion, body: request)
            reportSuccessMessage = "Question #\(questionId) was reported to admin."
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch let e as APIError {
            error = e.errorDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        } catch {
            self.error = error.localizedDescription
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }

    func startTimer() {
        timerTask?.cancel()
        timerTask = Task {
            while timeRemainingSeconds > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { break }
                timeRemainingSeconds -= 1
            }
        }
    }

    func stopTimer() {
        timerTask?.cancel()
    }

    private func restoreSession(_ session: QuizSessionState?, questionCount: Int) {
        if let answers = session?.answers {
            currentAnswers = Dictionary(uniqueKeysWithValues: answers.compactMap { key, value in
                guard let intKey = Int(key) else { return nil }
                return (intKey, value)
            })
        }

        if let index = session?.currentQuestionIndex {
            currentQuestionIndex = max(0, min(max(questionCount - 1, 0), index))
        }

        revealedQuestionIds = Set(session?.revealedQuestionIds ?? [])
        flaggedQuestionIds = Set(session?.flaggedQuestionIds ?? [])
    }

    private func restoreSavedPracticeAnswersIfNeeded(from response: QuizLoadResponse) {
        guard response.mode == QuizMode.practice.rawValue else { return }
        for question in response.questions where currentAnswers[question.id] == nil {
            guard let savedAnswer = question.savedAnswer else { continue }
            if question.isTrueFalse {
                if !savedAnswer.tfMap.isEmpty {
                    currentAnswers[question.id] = .trueFalse(savedAnswer.tfMap)
                }
            } else if let firstSelection = savedAnswer.selectedIds.first {
                currentAnswers[question.id] = .single(firstSelection)
            }
        }
    }

    private func loadQuestionBookmarks() async {
        do {
            let response: BookmarksResponse = try await APIClient.shared.request(.listBookmarks)
            bookmarkedQuestionIds = Set((response.bookmarks ?? [])
                .filter { $0.itemType == "question" }
                .map(\.itemId))
        } catch {
            bookmarkedQuestionIds = []
        }
    }

    private func savePracticeAnswerIfNeeded(
        questionId: Int,
        quizId: Int,
        mode: QuizMode,
        selected: [Int]?,
        tfAnswers: [String: Bool]?
    ) async {
        guard mode == .practice else { return }
        let request = SavePracticeAnswerRequest(
            questionId: questionId,
            questionIndex: questionIndex(for: questionId),
            questionType: question(for: questionId)?.backendQuestionType ?? "sba",
            selected: selected,
            tfAnswers: tfAnswers?.mapValues { $0 ? 1 : 0 }
        )
        try? await APIClient.shared.requestVoid(.savePracticeAnswer(id: quizId), body: request)
    }

    private func question(for questionId: Int) -> QuizQuestion? {
        quizData?.questions.first { $0.id == questionId }
    }

    private func questionIndex(for questionId: Int) -> Int {
        quizData?.questions.firstIndex { $0.id == questionId } ?? currentQuestionIndex
    }

    private var encodedAnswers: [String: QuizAnswerValue] {
        Dictionary(uniqueKeysWithValues: currentAnswers.map { (String($0.key), $0.value) })
    }
}

struct QuizListView: View {
    @State private var vm = QuizViewModel()
    @Environment(\.horizontalSizeClass) var sizeClass

    var body: some View {
        VStack(spacing: 0) {
            RootTabHeader(title: "Quizzes")

            Group {
                if vm.isLoading && vm.quizzes.isEmpty {
                    LoadingView(message: "Loading quizzes...")
                } else if let err = vm.error, vm.quizzes.isEmpty {
                    ErrorView(message: err, onRetry: { Task { await vm.loadList() } })
                } else if vm.quizzes.isEmpty {
                    EmptyStateView(
                        icon: "checkmark.circle",
                        title: "No Quizzes Yet",
                        message: "Available quizzes will appear here."
                    )
                } else if sizeClass == .regular {
                    ScrollView {
                        LazyVGrid(
                            columns: adaptiveColumns(compact: 2, regular: 3, sizeClass: sizeClass),
                            spacing: XyndromeTheme.Spacing.md
                        ) {
                            ForEach(vm.quizzes) { quiz in
                                NavigationLink(value: quiz) {
                                    QuizRowView(quiz: quiz)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(pagePadding(sizeClass))
                        .pageFrame()
                    }
                    .background(XyndromeTheme.Colors.surface)
                } else {
                    List(vm.quizzes) { quiz in
                        NavigationLink(value: quiz) {
                            QuizRowView(quiz: quiz)
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
        .navigationTitle("Quizzes")
        .navigationBarTitleDisplayMode(sizeClass == .regular ? .large : .inline)
        .toolbar(sizeClass == .regular ? .visible : .hidden, for: .navigationBar)
        .navigationDestination(for: QuizSummary.self) { quiz in
            QuizDetailSheet(quiz: quiz)
        }
        .task { await vm.loadList() }
        .refreshable { await vm.loadList() }
    }
}

struct QuizRowView: View {
    let quiz: QuizSummary

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.md) {
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(quiz.accessLocked ? XyndromeTheme.Colors.warning.opacity(0.16) : XyndromeTheme.Colors.primary.opacity(0.12))
                .frame(width: 48, height: 48)
                .overlay {
                    Image(systemName: quiz.accessLocked ? "lock.fill" : "checkmark.circle.fill")
                        .foregroundStyle(quiz.accessLocked ? XyndromeTheme.Colors.warning : XyndromeTheme.Colors.primary)
                }

            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                Text(quiz.title)
                    .font(XyndromeTheme.Typography.headline())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .lineLimit(2)

                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    if let count = quiz.questionCount {
                        Label("\(count) Qs", systemImage: "list.bullet")
                    }
                    if let mins = quiz.durationMinutes {
                        Label("\(mins)m", systemImage: "clock")
                    }
                    if let subject = quiz.subject {
                        Text(subject)
                    }
                }
                .font(XyndromeTheme.Typography.caption())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)

                if let course = quiz.courseTitle {
                    Text(course)
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)
                        .lineLimit(1)
                }

                if let message = quiz.accessMessage, quiz.accessLocked {
                    Text(message)
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.warning)
                        .lineLimit(2)
                } else if let score = quiz.lastAttemptScore {
                    Text("Last: \(Int(score))%")
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.scoreColor(score))
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

struct QuizDetailSheet: View {
    let quiz: QuizSummary
    @State private var mode: QuizMode = .practice

    private var canStart: Bool {
        guard quiz.canAccess && !quiz.accessLocked else { return false }
        return mode == .practice ? quiz.canPracticeMode : quiz.canExamMode
    }

    var body: some View {
        ScrollView {
            VStack(spacing: XyndromeTheme.Spacing.xl) {
                VStack(spacing: XyndromeTheme.Spacing.sm) {
                    Image(systemName: quiz.accessLocked ? "lock.circle.fill" : "checkmark.circle.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(quiz.accessLocked ? XyndromeTheme.Colors.warning : XyndromeTheme.Colors.primary)

                    Text(quiz.title)
                        .font(XyndromeTheme.Typography.title2())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .multilineTextAlignment(.center)

                    if let description = quiz.description {
                        Text(description)
                            .font(XyndromeTheme.Typography.body())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.top, XyndromeTheme.Spacing.xl)

                HStack(spacing: XyndromeTheme.Spacing.xl) {
                    if let count = quiz.questionCount {
                        metaBlock(value: "\(count)", label: "Questions")
                    }
                    if let mins = quiz.durationMinutes {
                        metaBlock(value: "\(mins)m", label: "Duration")
                    }
                }

                if let message = quiz.accessMessage, quiz.accessLocked {
                    Label(message, systemImage: "lock.fill")
                        .font(XyndromeTheme.Typography.footnote())
                        .foregroundStyle(XyndromeTheme.Colors.warning)
                        .padding(XyndromeTheme.Spacing.md)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                .fill(XyndromeTheme.Colors.warning.opacity(0.12))
                        )
                        .padding(.horizontal, XyndromeTheme.Spacing.md)
                }

                Picker("Mode", selection: $mode) {
                    Text("Practice").tag(QuizMode.practice)
                    Text("Exam").tag(QuizMode.exam)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, XyndromeTheme.Spacing.md)
                .disabled(quiz.examModeOnly || !quiz.canPracticeMode || !quiz.canExamMode)

                NavigationLink(destination: PracticeQuizView(quizId: quiz.id, mode: mode)) {
                    Text(mode == .exam ? "Start Exam" : "Start Practice")
                        .font(XyndromeTheme.Typography.headline())
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, XyndromeTheme.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                .fill(canStart ? XyndromeTheme.Colors.primary : XyndromeTheme.Colors.textMuted)
                        )
                }
                .disabled(!canStart)
                .padding(.horizontal, XyndromeTheme.Spacing.md)
            }
            .padding(.bottom, XyndromeTheme.Spacing.xxl)
        }
        .background(XyndromeTheme.Colors.surface.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if quiz.examModeOnly || !quiz.canPracticeMode {
                mode = .exam
            }
        }
    }

    private func metaBlock(value: String, label: String) -> some View {
        VStack {
            Text(value)
                .font(XyndromeTheme.Typography.title2())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
            Text(label)
                .font(XyndromeTheme.Typography.caption())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
        }
    }
}
