import SwiftUI

@Observable
@MainActor
final class ResultsViewModel {
    nonisolated init() {}
    var results: [AttemptResult] = []
    var detail: ResultDetailResponse?
    var review: ReviewResponse?
    var practiceReview: PracticeReviewResponse?
    var isLoading = false
    var error: String?

    func loadList() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let response: ResultsListResponse = try await APIClient.shared.request(.listResults)
            results = response.results ?? []
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadDetail(attemptId: Int) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            detail = try await APIClient.shared.request(.getResult(attemptId: attemptId))
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadReview(attemptId: Int) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            review = try await APIClient.shared.request(.getReview(attemptId: attemptId))
            try? await APIClient.shared.requestVoid(.completeReview(attemptId: attemptId))
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadPracticeReview(quizId: Int) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            practiceReview = try await APIClient.shared.request(
                .getPracticeReview(attemptId: quizId),
                queryItems: [URLQueryItem(name: "complete", value: "1")]
            )
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct ResultDetailView: View {
    let attemptId: Int
    @State private var vm = ResultsViewModel()

    var body: some View {
        Group {
            if vm.isLoading && vm.detail == nil {
                LoadingView(message: "Loading result...")
            } else if let err = vm.error, vm.detail == nil {
                ErrorView(message: err, onRetry: { Task { await vm.loadDetail(attemptId: attemptId) } })
            } else if let result = vm.detail?.result {
                resultContent(result)
            }
        }
        .navigationTitle("Result")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.loadDetail(attemptId: attemptId) }
    }

    @ViewBuilder
    private func resultContent(_ result: AttemptResult) -> some View {
        ScrollView {
            VStack(spacing: XyndromeTheme.Spacing.xl) {
                // Score circle
                ZStack {
                    Circle()
                        .strokeBorder(XyndromeTheme.Colors.surfaceTertiary, lineWidth: 12)
                        .frame(width: 140, height: 140)
                    Circle()
                        .trim(from: 0, to: CGFloat((result.score ?? 0) / 100))
                        .stroke(XyndromeTheme.Colors.scoreColor(result.score ?? 0), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                        .frame(width: 140, height: 140)
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 2) {
                        Text("\(Int(result.score ?? 0))%")
                            .font(XyndromeTheme.Typography.title1())
                            .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        Text(result.passed == true ? "Passed" : "Failed")
                            .font(XyndromeTheme.Typography.caption())
                            .foregroundStyle(result.passed == true ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.error)
                    }
                }
                .padding(.top, XyndromeTheme.Spacing.xl)

                // Stats
                HStack(spacing: XyndromeTheme.Spacing.xl) {
                    if let correct = result.correctAnswers, let total = result.totalQuestions {
                        VStack {
                            Text("\(correct)/\(total)")
                                .font(XyndromeTheme.Typography.title3())
                                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                            Text("Correct")
                                .font(XyndromeTheme.Typography.caption())
                                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        }
                    }
                    if let seconds = result.timeTakenSeconds {
                        VStack {
                            Text("\(seconds / 60)m")
                                .font(XyndromeTheme.Typography.title3())
                                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                            Text("Time Taken")
                                .font(XyndromeTheme.Typography.caption())
                                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                        }
                    }
                }

                // Analysis
                if let analysis = vm.detail?.analysis {
                    VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
                        if let strong = analysis.strongTopics, !strong.isEmpty {
                            AnalysisSection(title: "Strong Topics", items: strong, color: XyndromeTheme.Colors.success)
                        }
                        if let weak = analysis.weakTopics, !weak.isEmpty {
                            AnalysisSection(title: "Needs Work", items: weak, color: XyndromeTheme.Colors.warning)
                        }
                    }
                    .padding(.horizontal, XyndromeTheme.Spacing.md)
                }

                NavigationLink(destination: ReviewWorkspaceView(attemptId: attemptId)) {
                    Text("Review Answers")
                        .font(XyndromeTheme.Typography.headline())
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, XyndromeTheme.Spacing.sm)
                        .background(RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md).fill(XyndromeTheme.Colors.primary))
                }
                .padding(.horizontal, XyndromeTheme.Spacing.md)
                .padding(.bottom, XyndromeTheme.Spacing.xl)
            }
        }
        .background(XyndromeTheme.Colors.surface)
    }
}

struct AnalysisSection: View {
    let title: String
    let items: [String]
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
            Text(title)
                .font(XyndromeTheme.Typography.headline())
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
            ForEach(items, id: \.self) { item in
                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    Circle().fill(color).frame(width: 6, height: 6)
                    Text(item)
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(color.opacity(0.08))
        )
    }
}

struct ReviewWorkspaceView: View {
    let attemptId: Int
    @State private var vm = ResultsViewModel()

    var body: some View {
        Group {
            if vm.isLoading {
                LoadingView(message: "Loading review...")
            } else if let err = vm.error {
                ErrorView(message: err, onRetry: { Task { await vm.loadReview(attemptId: attemptId) } })
            } else if let answers = vm.review?.answers {
                ReviewAnswersList(
                    answers: answers,
                    title: vm.review?.result?.quizTitle ?? "Answer review",
                    score: vm.review?.result?.score
                )
            }
        }
        .navigationTitle("Review")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.loadReview(attemptId: attemptId) }
    }

}

struct PracticeReviewWorkspaceView: View {
    let quizId: Int
    let initialReview: PracticeReviewResponse?
    @State private var vm = ResultsViewModel()

    var body: some View {
        Group {
            if vm.isLoading && vm.practiceReview == nil {
                LoadingView(message: "Loading practice review...")
            } else if let err = vm.error, vm.practiceReview == nil {
                ErrorView(message: err, onRetry: { Task { await vm.loadPracticeReview(quizId: quizId) } })
            } else if let review = vm.practiceReview {
                ReviewAnswersList(
                    answers: review.questions,
                    title: review.quiz?.title ?? "Practice review",
                    score: review.summary?.percentage
                )
            }
        }
        .navigationTitle("Practice Review")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if vm.practiceReview == nil {
                if let initialReview {
                    vm.practiceReview = initialReview
                } else {
                    await vm.loadPracticeReview(quizId: quizId)
                }
            }
        }
    }
}

struct ReviewAnswersList: View {
    let answers: [ReviewAnswer]
    let title: String
    let score: Double?

    private var counts: (correct: Int, wrong: Int, unanswered: Int) {
        answers.reduce(into: (correct: 0, wrong: 0, unanswered: 0)) { acc, answer in
            if answer.answerStatus == "unanswered" {
                acc.unanswered += 1
            } else if answer.isCorrect == true {
                acc.correct += 1
            } else {
                acc.wrong += 1
            }
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
                ReviewSummaryCard(title: title, score: score, total: answers.count, counts: counts)

                ForEach(Array(answers.enumerated()), id: \.element.id) { index, answer in
                    ReviewAnswerRow(index: index + 1, answer: answer)
                }
            }
            .padding(XyndromeTheme.Spacing.md)
        }
        .background(XyndromeTheme.Colors.surface)
    }
}

struct ReviewSummaryCard: View {
    let title: String
    let score: Double?
    let total: Int
    let counts: (correct: Int, wrong: Int, unanswered: Int)

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                    Text(title)
                        .font(XyndromeTheme.Typography.title3())
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                    Text("\(total) questions reviewed")
                        .font(XyndromeTheme.Typography.subheadline())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }
                Spacer()
                if let score {
                    Text("\(Int(score.rounded()))%")
                        .font(XyndromeTheme.Typography.title2())
                        .foregroundStyle(XyndromeTheme.Colors.scoreColor(score))
                }
            }

            HStack(spacing: XyndromeTheme.Spacing.sm) {
                ReviewStatPill(title: "Correct", value: counts.correct, tint: XyndromeTheme.Colors.success)
                ReviewStatPill(title: "Wrong", value: counts.wrong, tint: XyndromeTheme.Colors.error)
                ReviewStatPill(title: "Blank", value: counts.unanswered, tint: XyndromeTheme.Colors.warning)
            }
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(XyndromeTheme.Colors.surfaceSecondary)
        )
    }
}

struct ReviewStatPill: View {
    let title: String
    let value: Int
    let tint: Color

    var body: some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(XyndromeTheme.Typography.headline())
                .foregroundStyle(tint)
            Text(title)
                .font(XyndromeTheme.Typography.caption())
                .foregroundStyle(XyndromeTheme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, XyndromeTheme.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(tint.opacity(0.08))
        )
    }
}

struct ReviewAnswerRow: View {
    let index: Int
    let answer: ReviewAnswer

    private var statusColor: Color {
        if answer.answerStatus == "unanswered" { return XyndromeTheme.Colors.warning }
        return answer.isCorrect == true ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.error
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.md) {
            HStack {
                Text("Q\(index)")
                    .font(XyndromeTheme.Typography.caption())
                    .foregroundStyle(XyndromeTheme.Colors.textMuted)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(XyndromeTheme.Colors.surfaceTertiary))

                Spacer()

                Label(answer.statusLabel, systemImage: answer.isCorrect == true ? "checkmark.circle.fill" : answer.answerStatus == "unanswered" ? "minus.circle.fill" : "xmark.circle.fill")
                    .font(XyndromeTheme.Typography.caption().weight(.semibold))
                    .foregroundStyle(statusColor)
            }

            Text(answer.questionText)
                .font(XyndromeTheme.Typography.subheadline().weight(.semibold))
                .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: XyndromeTheme.Spacing.sm) {
                ForEach(Array(answer.options.enumerated()), id: \.element.id) { optionIndex, option in
                    ReviewOptionRow(answer: answer, option: option, displayLabel: optionDisplayLabel(option, index: optionIndex))
                }
            }

            ReviewLearningSupportView(answer: answer)
        }
        .padding(XyndromeTheme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                .fill(statusColor.opacity(0.055))
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.md)
                        .strokeBorder(statusColor.opacity(0.2), lineWidth: 1)
                )
        )
    }

    private func optionDisplayLabel(_ option: QuizOption, index: Int) -> String {
        if let label = option.label, !label.isEmpty { return label }
        let scalar = UnicodeScalar(65 + min(index, 25))!
        return String(Character(scalar))
    }
}

struct ReviewOptionRow: View {
    let answer: ReviewAnswer
    let option: QuizOption
    let displayLabel: String

    private var isCorrectOption: Bool {
        option.isCorrect == true || answer.correctOptionIds.contains(option.id)
    }

    private var isSelectedOption: Bool {
        answer.selectedOptionIds.contains(option.id)
    }

    private var selectedTrueFalse: Bool? {
        answer.trueFalseAnswers[option.id]
    }

    private var rowColor: Color {
        if answer.isTrueFalse {
            guard let selectedTrueFalse else { return XyndromeTheme.Colors.warning }
            return selectedTrueFalse == isCorrectOption ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.error
        }
        if isCorrectOption { return XyndromeTheme.Colors.success }
        if isSelectedOption { return XyndromeTheme.Colors.error }
        return XyndromeTheme.Colors.textMuted
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
            HStack(alignment: .top, spacing: XyndromeTheme.Spacing.sm) {
                Text(answer.isTrueFalse ? trueFalseIcon : displayLabel)
                    .font(XyndromeTheme.Typography.caption().weight(.bold))
                    .foregroundStyle(rowColor)
                    .frame(width: 26, height: 26)
                    .background(Circle().fill(rowColor.opacity(0.13)))

                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                    Text(option.text)
                        .font(XyndromeTheme.Typography.footnote().weight(.semibold))
                        .foregroundStyle(XyndromeTheme.Colors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)

                    FlowLabels(labels: optionLabels)
                }

                Spacer(minLength: 0)
            }
        }
        .padding(XyndromeTheme.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                .fill(rowColor.opacity(0.06))
                .overlay(
                    RoundedRectangle(cornerRadius: XyndromeTheme.Radius.sm)
                        .strokeBorder(rowColor.opacity(0.16), lineWidth: 1)
                )
        )
    }

    private var trueFalseIcon: String {
        guard let selectedTrueFalse else { return displayLabel }
        return selectedTrueFalse == isCorrectOption ? "T" : "F"
    }

    private var optionLabels: [(String, Color)] {
        if answer.isTrueFalse {
            let your = selectedTrueFalse.map { $0 ? "Your: True" : "Your: False" } ?? "Your: Blank"
            let correct = isCorrectOption ? "Correct: True" : "Correct: False"
            let yourColor = selectedTrueFalse == nil
                ? XyndromeTheme.Colors.warning
                : selectedTrueFalse == isCorrectOption ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.error
            return [(your, yourColor), (correct, XyndromeTheme.Colors.success)]
        }

        var labels: [(String, Color)] = []
        if isSelectedOption {
            labels.append(("Your answer", isCorrectOption ? XyndromeTheme.Colors.success : XyndromeTheme.Colors.error))
        }
        if isCorrectOption {
            labels.append(("Correct", XyndromeTheme.Colors.success))
        }
        if answer.answerStatus == "unanswered", isCorrectOption {
            labels.append(("Unanswered", XyndromeTheme.Colors.warning))
        }
        return labels
    }
}

struct FlowLabels: View {
    let labels: [(String, Color)]

    var body: some View {
        if !labels.isEmpty {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: XyndromeTheme.Spacing.xs) {
                    labelViews
                }
                VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xxs) {
                    labelViews
                }
            }
        }
    }

    private var labelViews: some View {
        ForEach(Array(labels.enumerated()), id: \.offset) { _, item in
            Text(item.0)
                .font(XyndromeTheme.Typography.caption2().weight(.bold))
                .foregroundStyle(item.1)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(Capsule().fill(item.1.opacity(0.1)))
        }
    }
}

struct ReviewLearningSupportView: View {
    let answer: ReviewAnswer

    private var incorrectReasons: [(label: String, text: String, reason: String)] {
        answer.options.enumerated().compactMap { index, option in
            let reason = (option.whyIncorrect ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !reason.isEmpty else { return nil }
            if !answer.isTrueFalse && (option.isCorrect == true || answer.correctOptionIds.contains(option.id)) { return nil }
            return (displayLabel(option, index: index), option.text, reason)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.sm) {
            if !answer.explanationBlocks.isEmpty {
                LearningCard(title: "Explanation", icon: "checkmark.seal", tint: XyndromeTheme.Colors.primary) {
                    VStack(alignment: .leading, spacing: XyndromeTheme.Spacing.xs) {
                        ForEach(Array(answer.explanationBlocks.enumerated()), id: \.offset) { _, block in
                            Text(block)
                                .font(XyndromeTheme.Typography.footnote())
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

            if let recap = answer.theoryRecap, recap.hasContent {
                QuickTheoryRecapCard(recap: recap)
            }

            if answer.explanationBlocks.isEmpty && incorrectReasons.isEmpty && answer.theoryRecap?.hasContent != true {
                LearningCard(title: "Explanation", icon: "text.bubble", tint: XyndromeTheme.Colors.textMuted) {
                    Text("No written explanation is available for this question yet.")
                        .font(XyndromeTheme.Typography.footnote())
                        .foregroundStyle(XyndromeTheme.Colors.textSecondary)
                }
            }
        }
    }

    private func displayLabel(_ option: QuizOption, index: Int) -> String {
        if let label = option.label, !label.isEmpty { return label }
        let scalar = UnicodeScalar(65 + min(index, 25))!
        return String(Character(scalar))
    }
}
