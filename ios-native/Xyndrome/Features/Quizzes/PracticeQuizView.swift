import SwiftUI
import UIKit

struct PracticeQuizView: View {
    let quizId: Int
    let mode: QuizMode

    @State private var vm = QuizViewModel()
    @State private var showSubmitConfirm = false
    @State private var reportQuestionId: Int?
    @State private var reportComment = ""
    @Environment(\.dismiss) var dismiss

    private var questions: [QuizQuestion] { vm.quizData?.questions ?? [] }
    private var currentQuestion: QuizQuestion? { questions[safe: vm.currentQuestionIndex] }
    private var isLastQuestion: Bool { vm.currentQuestionIndex == questions.count - 1 }
    private var answeredCount: Int { questions.filter(isAnswered).count }
    private var progressPercent: Int {
        guard !questions.isEmpty else { return 0 }
        return Int((Double(answeredCount) / Double(questions.count) * 100).rounded())
    }
    private var reportPromptPresented: Binding<Bool> {
        Binding(
            get: { reportQuestionId != nil },
            set: { isPresented in
                if !isPresented {
                    reportQuestionId = nil
                    reportComment = ""
                }
            }
        )
    }

    var body: some View {
        Group {
            if vm.isLoading && vm.quizData == nil {
                LoadingView(message: "Loading quiz...")
            } else if let err = vm.error, vm.quizData == nil {
                ErrorView(message: err, onRetry: { Task { await vm.loadQuiz(id: quizId, mode: mode) } })
            } else if let result = vm.finishedResult {
                QuizCompletedView(
                    result: result,
                    practiceReview: vm.completedPracticeReview,
                    quizId: quizId,
                    mode: mode,
                    onDismiss: { dismiss() }
                )
            } else if let question = currentQuestion {
                quizBody(question: question)
            } else {
                EmptyStateView(
                    icon: "questionmark.circle",
                    title: "No Questions",
                    message: "This quiz does not have questions available yet."
                )
            }
        }
        .navigationTitle(vm.quizData?.metadata?.title ?? "Quiz")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Exit") { dismiss() }
                    .foregroundStyle(XyndromeTheme.Colors.error)
            }
            if mode == .exam {
                ToolbarItem(placement: .navigationBarTrailing) {
                    TimerView(seconds: $vm.timeRemainingSeconds)
                }
            }
        }
        .task {
            await vm.loadQuiz(id: quizId, mode: mode)
            if mode == .exam { vm.startTimer() }
        }
        .onDisappear { vm.stopTimer() }
        .alert("Submit Quiz?", isPresented: $showSubmitConfirm) {
            Button("Submit", role: .destructive) {
                Task {
                    if mode == .exam {
                        await vm.submitExam(quizId: quizId)
                    } else {
                        await vm.finishPractice(quizId: quizId)
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            let total = questions.count
            Text("You've answered \(answeredCount) of \(total) questions. Submit your answers?")
        }
        .alert("Report Question", isPresented: reportPromptPresented) {
            TextField("Optional comment", text: $reportComment)
            Button("Submit") {
                guard let questionId = reportQuestionId else { return }
                let comment = reportComment
                reportQuestionId = nil
                reportComment = ""
                Task { await vm.reportQuestion(questionId: questionId, comment: comment) }
            }
            Button("Cancel", role: .cancel) {
                reportQuestionId = nil
                reportComment = ""
            }
        } message: {
            Text("Tell admin what is wrong with this question. You can leave the comment blank.")
        }
    }

    @ViewBuilder
    private func quizBody(question: QuizQuestion) -> some View {
        let revealedQuestion = vm.revealedQuestions[question.id]
        let isRevealed = revealedQuestion != nil
        let isMarkedRevealed = vm.revealedQuestionIds.contains(question.id)
        let questionType = question.isTrueFalse ? "True / False" : "SBA"

        VStack(spacing: 0) {
            PracticeOverviewPanel(
                total: questions.count,
                answered: answeredCount,
                current: vm.currentQuestionIndex + 1,
                progressPercent: progressPercent,
                mode: mode,
                questionType: questionType,
                timeRemaining: mode == .exam ? vm.timeRemainingSeconds : nil
            )
            .padding(.horizontal, XyndromeTheme.Spacing.md)
            .padding(.top, XyndromeTheme.Spacing.sm)

            QuestionNavigatorStrip(
                questions: questions,
                currentIndex: vm.currentQuestionIndex,
                answered: isAnswered,
                bookmarkedQuestionIds: vm.bookmarkedQuestionIds,
                flaggedQuestionIds: vm.flaggedQuestionIds,
                revealedQuestionIds: vm.revealedQuestionIds,
                onSelect: { index in
                    Task { await goToQuestion(index) }
                }
            )
            .padding(.top, XyndromeTheme.Spacing.xs)

            ScrollView {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.lg) {
                    if let err = vm.error {
                        InlineQuizBanner(message: err, systemImage: "exclamationmark.triangle.fill", tint: XyndromeTheme.Colors.error)
                    }

                    if let message = vm.reportSuccessMessage {
                        InlineQuizBanner(message: message, systemImage: "checkmark.circle.fill", tint: XyndromeTheme.Colors.success)
                    }

                    VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                        Text(question.text)
                            .font(XyndromeTheme.Typography.title3())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                            .lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(alignment: .top, spacing: XyndromeTheme.Spacing.xs) {
                            QuizStatusChip(
                                text: "Question \(vm.currentQuestionIndex + 1) of \(questions.count)",
                                systemImage: "list.number",
                                tint: XyndromeTheme.Colors.textSecondary
                            )
                            QuizStatusChip(text: questionType, systemImage: "doc.text", tint: XyndromeTheme.Colors.primary)
                            QuizStatusChip(
                                text: isAnswered(question) ? "Answered" : "Unanswered",
                                systemImage: isAnswered(question) ? "checkmark.circle.fill" : "circle",
                                tint: isAnswered(question) ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.warning
                            )
                            if isRevealed {
                                QuizStatusChip(text: "Explanation shown", systemImage: "lightbulb.fill", tint: XyndromeTheme.Colors.accent)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(XyndromeTheme.Spacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                            .fill(XyndromeTheme.Colors.surfaceSecondary)
                    )
                    .modifier(XyndromeTheme.Shadow.card())

                    if question.isTrueFalse {
                        VStack(spacing: XyndromeTheme.Spacing.sm) {
                            ForEach(Array(question.options.enumerated()), id: \.element.id) { index, option in
                                PracticeTrueFalseOptionRow(
                                    option: option,
                                    letter: optionLabel(for: option, index: index),
                                    selectedValue: vm.trueFalseValue(questionId: question.id, optionId: option.id),
                                    revealedOption: revealedOption(for: option, in: revealedQuestion),
                                    isRevealed: isRevealed,
                                    onPick: { value in
                                        let generator = UIImpactFeedbackGenerator(style: .light)
                                        generator.impactOccurred()
                                        Task {
                                            await vm.selectTrueFalseAnswer(
                                                questionId: question.id,
                                                optionId: option.id,
                                                value: value,
                                                quizId: quizId,
                                                mode: mode
                                            )
                                        }
                                    }
                                )
                            }
                        }
                    } else {
                        VStack(spacing: XyndromeTheme.Spacing.sm) {
                            ForEach(Array(question.options.enumerated()), id: \.element.id) { index, option in
                                PracticeSBAOptionButton(
                                    option: option,
                                    letter: optionLabel(for: option, index: index),
                                    isSelected: vm.selectedSBAOption(for: question.id) == option.id,
                                    revealedOption: revealedOption(for: option, in: revealedQuestion),
                                    isRevealed: isRevealed,
                                    onTap: {
                                        let generator = UIImpactFeedbackGenerator(style: .light)
                                        generator.impactOccurred()
                                        Task {
                                            await vm.selectSBAAnswer(
                                                questionId: question.id,
                                                optionId: option.id,
                                                quizId: quizId,
                                                mode: mode
                                            )
                                        }
                                    }
                                )
                            }
                        }
                    }

                    if mode == .practice {
                        PracticeAnswerRevealView(
                            question: question,
                            revealedQuestion: revealedQuestion,
                            isMarkedRevealed: isMarkedRevealed,
                            isAnswered: isAnswered(question),
                            isBusy: vm.questionActionBusy,
                            onReveal: {
                                Task {
                                    await vm.revealPracticeAnswer(quizId: quizId, questionId: question.id)
                                }
                            }
                        )
                    }

                    QuestionUtilityActions(
                        bookmarked: vm.bookmarkedQuestionIds.contains(question.id),
                        flagged: vm.flaggedQuestionIds.contains(question.id),
                        busy: vm.questionActionBusy || vm.isSubmitting,
                        onFlag: {
                            Task { await vm.toggleFlag(questionId: question.id, quizId: quizId, mode: mode) }
                        },
                        onBookmark: {
                            Task { await vm.toggleQuestionBookmark(questionId: question.id) }
                        },
                        onReport: {
                            reportQuestionId = question.id
                            reportComment = ""
                        }
                    )
                }
                .padding(.horizontal, XyndromeTheme.Spacing.md)
                .padding(.top, XyndromeTheme.Spacing.md)
                .padding(.bottom, XyndromeTheme.Spacing.lg)
            }

            QuizFooterActionBar(
                mode: mode,
                isFirst: vm.currentQuestionIndex == 0,
                isLast: isLastQuestion,
                canReveal: mode == .practice && isAnswered(question) && !isMarkedRevealed && (question.canRevealAnswer ?? true),
                isRevealBusy: vm.questionActionBusy,
                isSubmitting: vm.isSubmitting,
                onPrevious: { Task { await goToQuestion(vm.currentQuestionIndex - 1) } },
                onReveal: {
                    Task { await vm.revealPracticeAnswer(quizId: quizId, questionId: question.id) }
                },
                onNextOrFinish: {
                    if isLastQuestion {
                        showSubmitConfirm = true
                    } else {
                        Task { await goToQuestion(vm.currentQuestionIndex + 1) }
                    }
                }
            )
        }
        .background(XyndromeTheme.Colors.surface)
        .task(id: question.id) {
            if mode == .practice,
               isMarkedRevealed,
               vm.revealedQuestions[question.id] == nil {
                await vm.revealPracticeAnswer(quizId: quizId, questionId: question.id, userInitiated: false)
            }
        }
    }

    private func isAnswered(_ question: QuizQuestion) -> Bool {
        if question.isTrueFalse {
            return question.options.contains { vm.trueFalseValue(questionId: question.id, optionId: $0.id) != nil }
        }
        return vm.selectedSBAOption(for: question.id) != nil
    }

    private func goToQuestion(_ index: Int) async {
        let bounded = max(0, min(max(questions.count - 1, 0), index))
        vm.currentQuestionIndex = bounded
        await vm.autosave(quizId: quizId, mode: mode)
    }

    private func revealedOption(for option: QuizOption, in revealedQuestion: QuizQuestion?) -> QuizOption? {
        revealedQuestion?.options.first { $0.id == option.id }
    }

    private func optionLabel(for option: QuizOption, index: Int) -> String {
        if let label = option.label, !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return label
        }
        let scalars = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        return index < scalars.count ? String(scalars[index]) : "\(index + 1)"
    }
}

private struct PracticeOverviewPanel: View {
    let total: Int
    let answered: Int
    let current: Int
    let progressPercent: Int
    let mode: QuizMode
    let questionType: String
    let timeRemaining: Int?

    private let columns = Array(repeating: GridItem(.flexible(), spacing: XyndromeTheme.Spacing.xs), count: 4)

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            LazyVGrid(columns: columns, spacing: XyndromeTheme.Spacing.xs) {
                QuizSummaryTile(label: "Total", value: "\(total)", tint: XyndromeTheme.Colors.textSecondary)
                QuizSummaryTile(label: "Answered", value: "\(answered)", tint: XyndromeTheme.Colors.success)
                QuizSummaryTile(label: "Current", value: "\(current)", tint: XyndromeTheme.Colors.primary)
                QuizSummaryTile(label: "Progress", value: "\(progressPercent)%", tint: XyndromeTheme.Colors.accent)
            }

            ProgressView(value: Double(progressPercent), total: 100)
                .tint(XyndromeTheme.Colors.primary)

            HStack(spacing: XyndromeTheme.Spacing.xs) {
                QuizStatusChip(
                    text: mode == .exam ? "Exam" : "Practice",
                    systemImage: mode == .exam ? "timer" : "lightbulb",
                    tint: mode == .exam ? XyndromeTheme.Colors.warning : XyndromeTheme.Colors.primary
                )
                QuizStatusChip(text: questionType, systemImage: "doc.text", tint: XyndromeTheme.Colors.textSecondary)
                if let timeRemaining {
                    TimerView(seconds: .constant(timeRemaining))
                }
                Spacer(minLength: 0)
            }
        }
        .padding(XyndromeTheme.Spacing.sm)
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

private struct QuizSummaryTile: View {
    let label: String
    let value: String
    let tint: Color

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(tint)
                .minimumScaleFactor(0.72)
                .lineLimit(1)
            Text(label)
                .font(XyndromeTheme.Typography.caption2().weight(.bold))
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                .textCase(.uppercase)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, minHeight: 58)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(tint.opacity(0.08))
        )
    }
}

private struct QuestionNavigatorStrip: View {
    let questions: [QuizQuestion]
    let currentIndex: Int
    let answered: (QuizQuestion) -> Bool
    let bookmarkedQuestionIds: Set<Int>
    let flaggedQuestionIds: Set<Int>
    let revealedQuestionIds: Set<Int>
    let onSelect: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    ForEach(Array(questions.enumerated()), id: \.element.id) { index, question in
                        QuestionBubbleButton(
                            number: index + 1,
                            active: index == currentIndex,
                            answered: answered(question),
                            bookmarked: bookmarkedQuestionIds.contains(question.id),
                            flagged: flaggedQuestionIds.contains(question.id),
                            revealed: revealedQuestionIds.contains(question.id),
                            onTap: { onSelect(index) }
                        )
                    }
                }
                .padding(.horizontal, XyndromeTheme.Spacing.md)
            }

            HStack(spacing: XyndromeTheme.Spacing.sm) {
                QuestionLegendDot(text: "Current", tint: XyndromeTheme.Colors.primary)
                QuestionLegendDot(text: "Answered", tint: XyndromeTheme.Colors.success)
                QuestionLegendDot(text: "Saved", tint: XyndromeTheme.Colors.accent)
                QuestionLegendDot(text: "Flagged", tint: XyndromeTheme.Colors.warning)
            }
            .padding(.horizontal, XyndromeTheme.Spacing.md)
        }
    }
}

private struct QuestionBubbleButton: View {
    let number: Int
    let active: Bool
    let answered: Bool
    let bookmarked: Bool
    let flagged: Bool
    let revealed: Bool
    let onTap: () -> Void

    private var tint: Color {
        if active { return XyndromeTheme.Colors.primary }
        if flagged { return XyndromeTheme.Colors.warning }
        if bookmarked || revealed { return XyndromeTheme.Colors.accent }
        if answered { return XyndromeTheme.Colors.success }
        return XyndromeTheme.Colors.textMuted
    }

    var body: some View {
        Button(action: onTap) {
            Text("\(number)")
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundStyle(active ? .white : tint)
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .fill(active ? tint : tint.opacity(0.11))
                        .overlay(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                .strokeBorder(tint.opacity(active ? 0 : 0.35), lineWidth: 1)
                        )
                )
                .overlay(alignment: .topTrailing) {
                    if bookmarked || flagged {
                        Circle()
                            .fill(flagged ? XyndromeTheme.Colors.warning : XyndromeTheme.Colors.accent)
                            .frame(width: 8, height: 8)
                            .padding(5)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Question \(number)")
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }
}

private struct QuestionLegendDot: View {
    let text: String
    let tint: Color

    var body: some View {
        Label {
            Text(text)
                .font(XyndromeTheme.Typography.caption2().weight(.semibold))
        } icon: {
            Circle()
                .fill(tint.opacity(0.75))
                .frame(width: 8, height: 8)
        }
        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
    }
}

private struct InlineQuizBanner: View {
    let message: String
    let systemImage: String
    let tint: Color

    var body: some View {
        Label(message, systemImage: systemImage)
            .font(XyndromeTheme.Typography.footnote().weight(.semibold))
            .foregroundStyle(tint)
            .padding(XyndromeTheme.Spacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                    .fill(tint.opacity(0.1))
            )
    }
}

private struct QuizStatusChip: View {
    let text: String
    let systemImage: String
    let tint: Color

    var body: some View {
        Label(text, systemImage: systemImage)
            .font(XyndromeTheme.Typography.caption().weight(.bold))
            .foregroundStyle(tint)
            .lineLimit(1)
            .minimumScaleFactor(0.78)
            .padding(.horizontal, XyndromeTheme.Spacing.xs)
            .padding(.vertical, 6)
            .background(Capsule().fill(tint.opacity(0.1)))
    }
}

private struct PracticeSBAOptionButton: View {
    let option: QuizOption
    let letter: String
    let isSelected: Bool
    let revealedOption: QuizOption?
    let isRevealed: Bool
    let onTap: () -> Void

    private var isCorrect: Bool { revealedOption?.isCorrect == true || option.isCorrect == true }
    private var isWrong: Bool { isRevealed && isSelected && !isCorrect }
    private var tint: Color {
        if isRevealed && isCorrect { return XyndromeTheme.Colors.success }
        if isWrong { return XyndromeTheme.Colors.error }
        if isSelected { return XyndromeTheme.Colors.primary }
        return XyndromeTheme.Colors.textMuted
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
                HStack(alignment: .top, spacing: XyndromeTheme.Spacing.sm) {
                    Text(letter)
                        .font(XyndromeTheme.Typography.caption().weight(.black))
                        .foregroundStyle(isSelected || isCorrect || isWrong ? .white : tint)
                        .frame(width: 28, height: 28)
                        .background(Circle().fill(isSelected || isCorrect || isWrong ? tint : tint.opacity(0.12)))

                    Text(option.text)
                        .font(XyndromeTheme.Typography.body())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)

                    Spacer(minLength: 0)
                }

                if isRevealed && (isSelected || isCorrect) {
                    HStack(spacing: XyndromeTheme.Spacing.xs) {
                        if isSelected {
                            QuizStatusChip(
                                text: "Your answer",
                                systemImage: isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill",
                                tint: isCorrect ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.error
                            )
                        }
                        if isCorrect {
                            QuizStatusChip(text: "Correct", systemImage: "checkmark.seal.fill", tint: XyndromeTheme.Colors.success)
                        }
                    }
                    .padding(.leading, 40)
                }
            }
            .padding(XyndromeTheme.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                    .fill(tint.opacity(isSelected || isCorrect || isWrong ? 0.11 : 0.06))
                    .overlay(
                        RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                            .strokeBorder(tint.opacity(isSelected || isCorrect || isWrong ? 0.48 : 0.12), lineWidth: 1.3)
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

private struct PracticeTrueFalseOptionRow: View {
    let option: QuizOption
    let letter: String
    let selectedValue: Bool?
    let revealedOption: QuizOption?
    let isRevealed: Bool
    let onPick: (Bool) -> Void

    private var correctValue: Bool? { revealedOption?.isCorrect ?? option.isCorrect }
    private var selectedCorrect: Bool {
        guard let selectedValue, let correctValue else { return false }
        return selectedValue == correctValue
    }
    private var tint: Color {
        if isRevealed && selectedValue == nil { return XyndromeTheme.Colors.warning }
        if isRevealed && selectedCorrect { return XyndromeTheme.Colors.success }
        if isRevealed && selectedValue != nil { return XyndromeTheme.Colors.error }
        if selectedValue != nil { return XyndromeTheme.Colors.primary }
        return XyndromeTheme.Colors.textMuted
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            HStack(alignment: .top, spacing: XyndromeTheme.Spacing.sm) {
                Text(letter)
                    .font(XyndromeTheme.Typography.caption().weight(.black))
                    .foregroundStyle(selectedValue != nil || isRevealed ? .white : tint)
                    .frame(width: 28, height: 28)
                    .background(Circle().fill(selectedValue != nil || isRevealed ? tint : tint.opacity(0.12)))

                Text(option.text)
                    .font(XyndromeTheme.Typography.body())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if isRevealed, let correctValue {
                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    QuizStatusChip(
                        text: selectedValue == nil ? "Your answer: None" : "Your answer: \(selectedValue == true ? "True" : "False")",
                        systemImage: selectedCorrect ? "checkmark.circle.fill" : "xmark.circle.fill",
                        tint: selectedCorrect ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.error
                    )
                    QuizStatusChip(
                        text: "Correct: \(correctValue ? "True" : "False")",
                        systemImage: "checkmark.seal.fill",
                        tint: XyndromeTheme.Colors.success
                    )
                }
                .padding(.leading, 40)
            }

            HStack(spacing: XyndromeTheme.Spacing.sm) {
                trueFalseButton(title: "True", value: true)
                trueFalseButton(title: "False", value: false)
            }
            .padding(.leading, 40)
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                .fill(tint.opacity(selectedValue != nil || isRevealed ? 0.1 : 0.06))
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.lg)
                        .strokeBorder(tint.opacity(selectedValue != nil || isRevealed ? 0.42 : 0.12), lineWidth: 1.2)
                )
        )
    }

    private func trueFalseButton(title: String, value: Bool) -> some View {
        let isSelected = selectedValue == value
        let isCorrectChoice = isRevealed && correctValue == value
        let isWrongChoice = isRevealed && isSelected && correctValue != value
        let buttonTint = isCorrectChoice ? XyndromeTheme.Colors.success : isWrongChoice ? XyndromeTheme.Colors.error : XyndromeTheme.Colors.primary

        return Button {
            onPick(value)
        } label: {
            Text(title)
                .font(XyndromeTheme.Typography.subheadline().weight(.semibold))
                .foregroundStyle(isSelected || isCorrectChoice || isWrongChoice ? .white : XyndromeTheme.Colors.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 42)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .fill(isSelected || isCorrectChoice || isWrongChoice ? buttonTint : XyndromeTheme.Colors.surface)
                )
        }
        .buttonStyle(.plain)
    }
}

private struct QuestionUtilityActions: View {
    let bookmarked: Bool
    let flagged: Bool
    let busy: Bool
    let onFlag: () -> Void
    let onBookmark: () -> Void
    let onReport: () -> Void

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.sm) {
            utilityButton(
                title: flagged ? "Flagged" : "Flag",
                systemImage: flagged ? "flag.fill" : "flag",
                tint: XyndromeTheme.Colors.warning,
                active: flagged,
                action: onFlag
            )
            utilityButton(
                title: bookmarked ? "Saved" : "Save",
                systemImage: bookmarked ? "bookmark.fill" : "bookmark",
                tint: XyndromeTheme.Colors.accent,
                active: bookmarked,
                action: onBookmark
            )
            utilityButton(
                title: "Report",
                systemImage: "exclamationmark.bubble",
                tint: XyndromeTheme.Colors.error,
                active: false,
                action: onReport
            )
        }
        .disabled(busy)
    }

    private func utilityButton(
        title: String,
        systemImage: String,
        tint: Color,
        active: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(XyndromeTheme.Typography.caption().weight(.bold))
                .foregroundStyle(active ? tint : XyndromeTheme.Colors.textSecondary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .fill(active ? tint.opacity(0.12) : XyndromeTheme.Colors.surfaceSecondary)
                        .overlay(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                .strokeBorder(active ? tint.opacity(0.3) : XyndromeTheme.Colors.textMuted.opacity(0.12), lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

private struct QuizFooterActionBar: View {
    let mode: QuizMode
    let isFirst: Bool
    let isLast: Bool
    let canReveal: Bool
    let isRevealBusy: Bool
    let isSubmitting: Bool
    let onPrevious: () -> Void
    let onReveal: () -> Void
    let onNextOrFinish: () -> Void

    var body: some View {
        HStack(spacing: XyndromeTheme.Spacing.sm) {
            footerButton(
                title: "Previous",
                systemImage: "chevron.left",
                tint: XyndromeTheme.Colors.textSecondary,
                filled: false,
                disabled: isFirst || isSubmitting,
                action: onPrevious
            )

            if mode == .practice {
                footerButton(
                    title: isRevealBusy ? "Loading" : "Show",
                    systemImage: "lightbulb",
                    tint: XyndromeTheme.Colors.accent,
                    filled: false,
                    disabled: !canReveal || isRevealBusy || isSubmitting,
                    action: onReveal
                )
            }

            footerButton(
                title: isLast ? (mode == .exam ? "Submit" : "Finish") : "Next",
                systemImage: isLast ? "checkmark" : "chevron.right",
                tint: XyndromeTheme.Colors.primary,
                filled: true,
                disabled: isSubmitting,
                action: onNextOrFinish
            )
        }
        .padding(.horizontal, XyndromeTheme.Spacing.md)
        .padding(.top, XyndromeTheme.Spacing.sm)
        .padding(.bottom, XyndromeTheme.Spacing.sm)
        .background(.regularMaterial)
    }

    private func footerButton(
        title: String,
        systemImage: String,
        tint: Color,
        filled: Bool,
        disabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(XyndromeTheme.Typography.subheadline().weight(.bold))
                .foregroundStyle(filled ? .white : tint)
                .frame(maxWidth: .infinity, minHeight: 46)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .fill(filled ? tint : tint.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                                .strokeBorder(filled ? Color.clear : tint.opacity(0.25), lineWidth: 1)
                        )
                )
                .opacity(disabled ? 0.45 : 1)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }
}

struct PracticeAnswerRevealView: View {
    let question: QuizQuestion
    let revealedQuestion: QuizQuestion?
    let isMarkedRevealed: Bool
    let isAnswered: Bool
    let isBusy: Bool
    let onReveal: () -> Void

    private var canReveal: Bool {
        question.canRevealAnswer ?? true
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            if let revealedQuestion {
                QuizLearningSupportView(question: revealedQuestion)
            } else if isMarkedRevealed {
                LearningCard(title: "Explanation", icon: "lightbulb", tint: XyndromeTheme.Colors.accent) {
                    HStack(spacing: XyndromeTheme.Spacing.sm) {
                        ProgressView()
                            .controlSize(.small)
                        Text("Loading the answer explanation...")
                            .font(XyndromeTheme.Typography.subheadline())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                    }
                }
            } else if canReveal {
                Button(action: onReveal) {
                    Label("Show explanation", systemImage: "lightbulb")
                        .font(XyndromeTheme.Typography.headline())
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryButtonStyle())
                .disabled(!isAnswered || isBusy)

                if !isAnswered {
                    Text("Answer this question first to reveal the explanation and key points.")
                        .font(XyndromeTheme.Typography.caption())
                        .foregroundStyle(XyndromeTheme.Colors.textMuted)
                }
            }
        }
        .padding(.top, XyndromeTheme.Spacing.sm)
    }
}

struct QuizLearningSupportView: View {
    let question: QuizQuestion

    private var explanationBlocks: [String] {
        (question.explanation ?? "")
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private var incorrectReasons: [(label: String, text: String, reason: String)] {
        question.options.enumerated().compactMap { index, option in
            let reason = (option.whyIncorrect ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !reason.isEmpty else { return nil }
            if !question.isTrueFalse && option.isCorrect == true { return nil }
            return (
                option.label ?? String(Character(UnicodeScalar(65 + min(index, 25))!)),
                option.text,
                reason
            )
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            if question.hasLearningSupport {
                if !explanationBlocks.isEmpty {
                    LearningCard(title: "Explanation", icon: "checkmark.seal", tint: XyndromeTheme.Colors.primary) {
                        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                            ForEach(Array(explanationBlocks.enumerated()), id: \.offset) { _, block in
                                Text(block)
                                    .font(XyndromeTheme.Typography.subheadline())
                                    .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }

                if !incorrectReasons.isEmpty {
                    LearningCard(title: "Why other answers are incorrect", icon: "xmark.seal", tint: XyndromeTheme.Colors.warning) {
                        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                            ForEach(incorrectReasons, id: \.label) { item in
                                HStack(alignment: .top, spacing: XyndromeTheme.Spacing.xs) {
                                    Text(item.label)
                                        .font(XyndromeTheme.Typography.caption().weight(.bold))
                                        .foregroundStyle(XyndromeTheme.Colors.warning)
                                        .frame(width: 24, height: 24)
                                        .background(Circle().fill(XyndromeTheme.Colors.warning.opacity(0.12)))

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.text)
                                            .font(XyndromeTheme.Typography.footnote().weight(.semibold))
                                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                                            .fixedSize(horizontal: false, vertical: true)
                                        Text(item.reason)
                                            .font(XyndromeTheme.Typography.footnote())
                                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                }
                            }
                        }
                    }
                }

                if let recap = question.theoryRecap, recap.hasContent {
                    QuickTheoryRecapCard(recap: recap)
                }
            } else {
                LearningCard(title: "Explanation", icon: "text.bubble", tint: XyndromeTheme.Colors.textMuted) {
                    Text("No written explanation is available for this question yet.")
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }
            }
        }
    }
}

struct QuickTheoryRecapCard: View {
    let recap: QuickTheoryRecap

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            LearningCard(title: "Key Points", icon: "list.bullet.clipboard", tint: XyndromeTheme.Colors.accent) {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                    if let concept = recap.conceptName, !concept.isEmpty {
                        Text(concept)
                            .font(XyndromeTheme.Typography.subheadline().weight(.semibold))
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    }
                    ForEach(recap.keyPoints.prefix(4), id: \.self) { point in
                        Label(point, systemImage: "checkmark")
                            .font(XyndromeTheme.Typography.footnote())
                            .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }

            LearningCard(title: "Quick Theory Recap", icon: "book.pages", tint: XyndromeTheme.Colors.accent) {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
                    RecapSection(title: "Pathophysiology", items: recap.pathophysiology)
                    RecapSection(title: "Clinical features", items: recap.clinicalFeatures)
                    RecapSection(title: "Investigations", items: recap.investigations)
                    RecapSection(title: "Treatment", items: recap.treatment)
                    RecapSection(title: "Etiology", items: recap.etiology)
                    if let mnemonic = recap.mnemonic, !mnemonic.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text("Mnemonic: \(mnemonic)")
                            .font(XyndromeTheme.Typography.footnote().weight(.semibold))
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }
}

struct RecapSection: View {
    let title: String
    let items: [String]

    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(XyndromeTheme.Typography.caption().weight(.bold))
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                ForEach(items.prefix(4), id: \.self) { item in
                    Text("- \(item)")
                        .font(XyndromeTheme.Typography.footnote())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

struct LearningCard<Content: View>: View {
    let title: String
    let icon: String
    let tint: Color
    private let content: Content

    init(title: String, icon: String, tint: Color, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.tint = tint
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            Label(title, systemImage: icon)
                .font(XyndromeTheme.Typography.caption().weight(.bold))
                .textCase(.uppercase)
                .foregroundStyle(tint)

            content
        }
        .padding(XyndromeTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(tint.opacity(0.06))
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .strokeBorder(tint.opacity(0.18), lineWidth: 1)
                )
        )
    }
}

struct TrueFalseOptionRow: View {
    let option: QuizOption
    let selectedValue: Bool?
    let onPick: (Bool) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            Text(option.text)
                .font(XyndromeTheme.Typography.body())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: XyndromeTheme.Spacing.sm) {
                trueFalseButton(title: "True", value: true)
                trueFalseButton(title: "False", value: false)
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .strokeBorder(
                            selectedValue == nil ? Color.clear : XyndromeTheme.Colors.primary.opacity(0.45),
                            lineWidth: 1.2
                        )
                )
        )
    }

    private func trueFalseButton(title: String, value: Bool) -> some View {
        Button {
            onPick(value)
        } label: {
            Text(title)
                .font(XyndromeTheme.Typography.subheadline().weight(.semibold))
                .foregroundStyle(selectedValue == value ? .white : XyndromeTheme.Colors.textPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, XyndromeTheme.Spacing.xs)
                .background(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .fill(selectedValue == value ? XyndromeTheme.Colors.primary : XyndromeTheme.Colors.surface)
                )
        }
        .buttonStyle(.plain)
    }
}

struct TimerView: View {
    @Binding var seconds: Int

    private var formatted: String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%02d:%02d", m, s)
    }

    var body: some View {
        Label(formatted, systemImage: "timer")
            .font(XyndromeTheme.Typography.subheadline().monospacedDigit())
            .foregroundStyle(seconds < 300 ? XyndromeTheme.Colors.error : XyndromeTheme.Colors.textSecondary)
    }
}

struct QuizCompletedView: View {
    let result: AttemptResult
    let practiceReview: PracticeReviewResponse?
    let quizId: Int
    let mode: QuizMode
    let onDismiss: () -> Void

    private var score: Double { result.score ?? 0 }
    private var passed: Bool { result.passed ?? (score >= 60) }

    var body: some View {
        VStack(spacing: XyndromeTheme.Spacing.xl) {
            Spacer()

            Image(systemName: passed ? "checkmark.seal.fill" : "xmark.seal.fill")
                .font(.system(size: 80))
                .foregroundStyle(passed ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.error)

            VStack(spacing: XyndromeTheme.Spacing.xs) {
                Text(passed ? "Well done!" : "Keep practising")
                    .font(XyndromeTheme.Typography.title1())
                    .foregroundStyle(XyndromeTheme.Colors.textPrimary)

                Text("\(Int(score))%")
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .foregroundStyle(XyndromeTheme.Colors.scoreColor(score))

                if let correct = result.correctAnswers, let total = result.totalQuestions {
                    Text("\(correct) of \(total) correct")
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }
            }

            Spacer()

            VStack(spacing: XyndromeTheme.Spacing.sm) {
                if mode == .exam, result.id > 0 {
                    NavigationLink(destination: ResultDetailView(attemptId: result.id)) {
                        Text("View Detailed Results")
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, XyndromeTheme.Spacing.sm)
                            .background(RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md).fill(XyndromeTheme.Colors.primary))
                    }
                } else if practiceReview != nil {
                    NavigationLink(destination: PracticeReviewWorkspaceView(quizId: quizId, initialReview: practiceReview)) {
                        Text("Review Practice Answers")
                            .font(XyndromeTheme.Typography.headline())
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, XyndromeTheme.Spacing.sm)
                            .background(RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md).fill(XyndromeTheme.Colors.primary))
                    }
                }

                Button("Done", action: onDismiss)
                    .buttonStyle(SecondaryButtonStyle())
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, XyndromeTheme.Spacing.md)
            .padding(.bottom, XyndromeTheme.Spacing.xl)
        }
        .background(XyndromeTheme.Colors.surface.ignoresSafeArea())
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
