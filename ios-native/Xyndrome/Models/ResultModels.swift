import Foundation

struct ResultsListResponse: Decodable {
    let results: [AttemptResult]?

    enum CodingKeys: String, CodingKey {
        case results
        case items
        case data
    }

    init(from decoder: Decoder) throws {
        if let list = try? [AttemptResult](from: decoder) {
            results = list
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        results = (try? container.decodeIfPresent([AttemptResult].self, forKey: .results))
            ?? (try? container.decodeIfPresent([AttemptResult].self, forKey: .items))
            ?? (try? container.decodeIfPresent([AttemptResult].self, forKey: .data))
            ?? []
    }
}

struct AttemptResult: Decodable, Identifiable, Hashable {
    let id: Int
    let quizId: Int?
    let quizTitle: String?
    let courseTitle: String?
    let topicDisplay: String?
    let score: Double?
    let rawScore: Double?
    let totalMarks: Double?
    let totalQuestions: Int?
    let correctAnswers: Int?
    let wrongAnswers: Int?
    let unansweredQuestions: Int?
    let passingMarks: Double?
    let passStatus: String?
    let timeTakenSeconds: Int?
    let mode: String?
    let completedAt: String?
    let reviewedAt: String?
    let passed: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case attemptId
        case attempt_id
        case quizId
        case quiz_id
        case quizTitle
        case quiz_title
        case title
        case courseTitle
        case course_title
        case topicDisplay
        case topic_display
        case topicName
        case topic_name
        case score
        case percentage
        case totalMarks
        case total_marks
        case totalQuestions
        case total_questions
        case correctAnswers
        case correct_answers
        case wrongAnswers
        case wrong_answers
        case unansweredQuestions
        case unanswered_questions
        case passingMarks
        case passing_marks
        case passStatus
        case pass_status
        case status
        case passed
        case timeTakenSeconds
        case time_taken_seconds
        case mode
        case attemptType
        case attempt_type
        case attemptMode
        case attempt_mode
        case completedAt
        case completed_at
        case submittedAt
        case submitted_at
        case createdAt
        case created_at
        case reviewedAt
        case reviewed_at
    }

    init(
        id: Int,
        quizId: Int? = nil,
        quizTitle: String? = nil,
        courseTitle: String? = nil,
        topicDisplay: String? = nil,
        score: Double? = nil,
        rawScore: Double? = nil,
        totalMarks: Double? = nil,
        totalQuestions: Int? = nil,
        correctAnswers: Int? = nil,
        wrongAnswers: Int? = nil,
        unansweredQuestions: Int? = nil,
        passingMarks: Double? = nil,
        passStatus: String? = nil,
        timeTakenSeconds: Int? = nil,
        mode: String? = nil,
        completedAt: String? = nil,
        reviewedAt: String? = nil,
        passed: Bool? = nil
    ) {
        self.id = id
        self.quizId = quizId
        self.quizTitle = quizTitle
        self.courseTitle = courseTitle
        self.topicDisplay = topicDisplay
        self.score = score
        self.rawScore = rawScore
        self.totalMarks = totalMarks
        self.totalQuestions = totalQuestions
        self.correctAnswers = correctAnswers
        self.wrongAnswers = wrongAnswers
        self.unansweredQuestions = unansweredQuestions
        self.passingMarks = passingMarks
        self.passStatus = passStatus
        self.timeTakenSeconds = timeTakenSeconds
        self.mode = mode
        self.completedAt = completedAt
        self.reviewedAt = reviewedAt
        self.passed = passed
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.attemptId, .attempt_id, .id]) ?? 0
        quizId = container.decodeInt(for: [.quizId, .quiz_id])
        quizTitle = container.decodeString(for: [.quizTitle, .quiz_title, .title])
        courseTitle = container.decodeString(for: [.courseTitle, .course_title])
        topicDisplay = container.decodeString(for: [.topicDisplay, .topic_display, .topicName, .topic_name])
        let percentage = container.decodeDouble(for: [.percentage])
        let marks = container.decodeDouble(for: [.score])
        score = percentage ?? marks
        rawScore = percentage == nil ? nil : marks
        totalMarks = container.decodeDouble(for: [.totalMarks, .total_marks])
        totalQuestions = container.decodeInt(for: [.totalQuestions, .total_questions])
        correctAnswers = container.decodeInt(for: [.correctAnswers, .correct_answers])
        wrongAnswers = container.decodeInt(for: [.wrongAnswers, .wrong_answers])
        unansweredQuestions = container.decodeInt(for: [.unansweredQuestions, .unanswered_questions])
        passingMarks = container.decodeDouble(for: [.passingMarks, .passing_marks])
        passStatus = container.decodeString(for: [.passStatus, .pass_status, .status])
        timeTakenSeconds = container.decodeInt(for: [.timeTakenSeconds, .time_taken_seconds])
        mode = container.decodeString(for: [.mode, .attemptMode, .attempt_mode, .attemptType, .attempt_type])
        completedAt = container.decodeString(for: [.completedAt, .completed_at, .submittedAt, .submitted_at, .createdAt, .created_at])
        reviewedAt = container.decodeString(for: [.reviewedAt, .reviewed_at])

        if let explicitPassed = container.decodeBool(for: [.passed]) {
            passed = explicitPassed
        } else if let passStatus {
            passed = passStatus.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "pass"
        } else if let percentage = score, let passingMarks {
            passed = percentage >= passingMarks
        } else {
            passed = nil
        }
    }
}

struct ResultDetailResponse: Decodable {
    let result: AttemptResult?
    let analysis: ResultAnalysis?

    enum CodingKeys: String, CodingKey {
        case result
        case attempt
        case analysis
    }

    init(from decoder: Decoder) throws {
        let container = try? decoder.container(keyedBy: CodingKeys.self)
        result = (try? container?.decodeIfPresent(AttemptResult.self, forKey: .result))
            ?? (try? container?.decodeIfPresent(AttemptResult.self, forKey: .attempt))
            ?? (try? AttemptResult(from: decoder))
        analysis = try? container?.decodeIfPresent(ResultAnalysis.self, forKey: .analysis)
    }
}

struct ResultAnalysis: Decodable {
    let strongTopics: [String]?
    let weakTopics: [String]?
    let recommendations: [String]?
    let timeAnalysis: String?

    enum CodingKeys: String, CodingKey {
        case strongTopics
        case strong_topics
        case weakTopics
        case weak_topics
        case recommendations
        case timeAnalysis
        case time_analysis
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        strongTopics = container.decodeStringArray(for: [.strongTopics, .strong_topics])
        weakTopics = container.decodeStringArray(for: [.weakTopics, .weak_topics])
        recommendations = container.decodeStringArray(for: [.recommendations])
        timeAnalysis = container.decodeString(for: [.timeAnalysis, .time_analysis])
    }
}

struct ReviewResponse: Decodable {
    let result: AttemptResult?
    let answers: [ReviewAnswer]?
    let feedback: String?

    enum CodingKeys: String, CodingKey {
        case result
        case attempt
        case answers
        case questions
        case feedback
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        result = (try? container.decodeIfPresent(AttemptResult.self, forKey: .result))
            ?? (try? container.decodeIfPresent(AttemptResult.self, forKey: .attempt))
        answers = (try? container.decodeIfPresent([ReviewAnswer].self, forKey: .answers))
            ?? (try? container.decodeIfPresent([ReviewAnswer].self, forKey: .questions))
            ?? []
        feedback = container.decodeString(for: [.feedback])
    }
}

struct PracticeReviewResponse: Decodable {
    let quiz: QuizSummary?
    let summary: PracticeReviewSummary?
    let questions: [ReviewAnswer]

    enum CodingKeys: String, CodingKey {
        case quiz
        case summary
        case questions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        quiz = try? container.decodeIfPresent(QuizSummary.self, forKey: .quiz)
        summary = try? container.decodeIfPresent(PracticeReviewSummary.self, forKey: .summary)
        questions = (try? container.decodeIfPresent([ReviewAnswer].self, forKey: .questions)) ?? []
    }
}

struct PracticeReviewSummary: Decodable, Hashable {
    let total: Int
    let correct: Int
    let wrong: Int
    let unanswered: Int
    let score: Double
    let percentage: Double
    let passingMarks: Double?

    enum CodingKeys: String, CodingKey {
        case total
        case correct
        case wrong
        case unanswered
        case score
        case percentage
        case passingMarks
        case passing_marks
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        total = container.decodeInt(for: [.total]) ?? 0
        correct = container.decodeInt(for: [.correct]) ?? 0
        wrong = container.decodeInt(for: [.wrong]) ?? 0
        unanswered = container.decodeInt(for: [.unanswered]) ?? 0
        score = container.decodeDouble(for: [.score]) ?? 0
        percentage = container.decodeDouble(for: [.percentage]) ?? score
        passingMarks = container.decodeDouble(for: [.passingMarks, .passing_marks])
    }
}

struct ReviewAnswer: Decodable, Identifiable {
    let id: Int
    let questionId: Int
    let questionText: String
    let questionType: String
    let selectedOptionId: Int?
    let selectedOptionIds: [Int]
    let correctOptionId: Int?
    let correctOptionIds: [Int]
    let trueFalseAnswers: [Int: Bool]
    let isCorrect: Bool?
    let answerStatus: String?
    let questionScore: Double?
    let maxQuestionScore: Double?
    let explanation: String?
    let options: [QuizOption]
    let theoryRecap: QuickTheoryRecap?

    enum CodingKeys: String, CodingKey {
        case id
        case questionId
        case question_id
        case questionText
        case question_text
        case text
        case questionType
        case question_type
        case type
        case selectedOptionId
        case selected_option_id
        case selectedOptionIds
        case selected_option_ids
        case correctOptionId
        case correct_option_id
        case correctOptionIds
        case correct_option_ids
        case isCorrect
        case is_correct
        case answerStatus
        case answer_status
        case questionScore
        case question_score
        case maxQuestionScore
        case max_question_score
        case explanation
        case options
        case answerState
        case answer_state
        case answerKey
        case answer_key
        case theoryRecap
        case theory_recap
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id, .questionId, .question_id]) ?? 0
        questionId = container.decodeInt(for: [.questionId, .question_id, .id]) ?? id
        questionText = container.decodeString(for: [.questionText, .question_text, .text]) ?? ""
        questionType = container.decodeString(for: [.questionType, .question_type, .type]) ?? "sba"
        let answerState = (try? container.decodeIfPresent(ReviewAnswerState.self, forKey: .answerState))
            ?? (try? container.decodeIfPresent(ReviewAnswerState.self, forKey: .answer_state))
        let answerKey = (try? container.decodeIfPresent(QuizAnswerKey.self, forKey: .answerKey))
            ?? (try? container.decodeIfPresent(QuizAnswerKey.self, forKey: .answer_key))

        selectedOptionId = container.decodeInt(for: [.selectedOptionId, .selected_option_id])
        let decodedSelectedIds = (try? container.decodeIfPresent([Int].self, forKey: .selectedOptionIds))
            ?? (try? container.decodeIfPresent([Int].self, forKey: .selected_option_ids))
        selectedOptionIds = decodedSelectedIds
            ?? answerState?.selectedIds
            ?? selectedOptionId.map { [$0] }
            ?? []

        correctOptionId = container.decodeInt(for: [.correctOptionId, .correct_option_id])
        let decodedCorrectIds = (try? container.decodeIfPresent([Int].self, forKey: .correctOptionIds))
            ?? (try? container.decodeIfPresent([Int].self, forKey: .correct_option_ids))
        let optionRows = (try? container.decodeIfPresent([QuizOption].self, forKey: .options)) ?? []
        let correctIdsFromOptions = optionRows.filter { $0.isCorrect == true }.map(\.id)
        correctOptionIds = decodedCorrectIds
            ?? answerKey?.correctOptions.map(\.optionId)
            ?? (correctIdsFromOptions.isEmpty ? nil : correctIdsFromOptions)
            ?? correctOptionId.map { [$0] }
            ?? []

        trueFalseAnswers = answerState?.tfAnswers ?? [:]
        answerStatus = container.decodeString(for: [.answerStatus, .answer_status])
        if let explicit = container.decodeBool(for: [.isCorrect, .is_correct]) {
            isCorrect = explicit
        } else if let answerStatus {
            isCorrect = answerStatus == "correct"
        } else {
            isCorrect = nil
        }
        questionScore = container.decodeDouble(for: [.questionScore, .question_score])
        maxQuestionScore = container.decodeDouble(for: [.maxQuestionScore, .max_question_score])
        explanation = container.decodeString(for: [.explanation])
        options = optionRows
        theoryRecap = (try? container.decodeIfPresent(QuickTheoryRecap.self, forKey: .theoryRecap))
            ?? (try? container.decodeIfPresent(QuickTheoryRecap.self, forKey: .theory_recap))
    }

    var isTrueFalse: Bool {
        let normalized = questionType.lowercased().replacingOccurrences(of: "-", with: "_")
        return normalized == "true_false" || normalized == "truefalse" || normalized == "tf"
    }

    var statusLabel: String {
        if answerStatus == "unanswered" { return "Unanswered" }
        if isCorrect == true { return "Correct" }
        if isCorrect == false { return "Needs review" }
        return "Review"
    }

    var explanationBlocks: [String] {
        (explanation ?? "")
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }
}

struct ReviewAnswerState: Decodable {
    let selectedIds: [Int]
    let tfAnswers: [Int: Bool]

    enum CodingKeys: String, CodingKey {
        case selectedIds
        case selected_ids
        case tfMap
        case tf_map
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        selectedIds = (try? container.decodeIfPresent([Int].self, forKey: .selectedIds))
            ?? (try? container.decodeIfPresent([Int].self, forKey: .selected_ids))
            ?? []

        if let boolMap = (try? container.decodeIfPresent([String: Bool].self, forKey: .tfMap))
            ?? (try? container.decodeIfPresent([String: Bool].self, forKey: .tf_map)) {
            tfAnswers = Dictionary(uniqueKeysWithValues: boolMap.compactMap { key, value in
                guard let id = Int(key) else { return nil }
                return (id, value)
            })
            return
        }

        let intMap = (try? container.decodeIfPresent([String: Int].self, forKey: .tfMap))
            ?? (try? container.decodeIfPresent([String: Int].self, forKey: .tf_map))
            ?? [:]
        tfAnswers = Dictionary(uniqueKeysWithValues: intMap.compactMap { key, value in
            guard let id = Int(key) else { return nil }
            return (id, value == 1)
        })
    }
}

private extension KeyedDecodingContainer {
    func decodeString(for keys: [Key]) -> String? {
        for key in keys {
            if let value = try? decodeIfPresent(String.self, forKey: key) {
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { return trimmed }
            }
            if let value = try? decodeIfPresent(Int.self, forKey: key) {
                return String(value)
            }
            if let value = try? decodeIfPresent(Double.self, forKey: key) {
                return String(value)
            }
            if let value = try? decodeIfPresent(Bool.self, forKey: key) {
                return value ? "true" : "false"
            }
        }
        return nil
    }

    func decodeInt(for keys: [Key]) -> Int? {
        for key in keys {
            if let value = try? decodeIfPresent(Int.self, forKey: key) {
                return value
            }
            if let value = try? decodeIfPresent(Double.self, forKey: key) {
                return Int(value)
            }
            if let value = try? decodeIfPresent(String.self, forKey: key),
               let intValue = Int(value) {
                return intValue
            }
        }
        return nil
    }

    func decodeDouble(for keys: [Key]) -> Double? {
        for key in keys {
            if let value = try? decodeIfPresent(Double.self, forKey: key) {
                return value
            }
            if let value = try? decodeIfPresent(Int.self, forKey: key) {
                return Double(value)
            }
            if let value = try? decodeIfPresent(String.self, forKey: key),
               let doubleValue = Double(value) {
                return doubleValue
            }
        }
        return nil
    }

    func decodeBool(for keys: [Key]) -> Bool? {
        for key in keys {
            if let value = try? decodeIfPresent(Bool.self, forKey: key) {
                return value
            }
            if let value = try? decodeIfPresent(Int.self, forKey: key) {
                return value != 0
            }
            if let value = try? decodeIfPresent(String.self, forKey: key) {
                let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if ["1", "true", "yes", "pass", "passed", "correct"].contains(normalized) { return true }
                if ["0", "false", "no", "fail", "failed", "wrong", "incorrect"].contains(normalized) { return false }
            }
        }
        return nil
    }

    func decodeStringArray(for keys: [Key]) -> [String]? {
        for key in keys {
            if let value = try? decodeIfPresent([String].self, forKey: key) {
                return value.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            }
            if let value = try? decodeIfPresent(String.self, forKey: key) {
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { continue }
                if let data = trimmed.data(using: .utf8),
                   let decoded = try? JSONDecoder().decode([String].self, from: data) {
                    return decoded.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                }
                return trimmed
                    .components(separatedBy: .newlines)
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
            }
        }
        return nil
    }
}
