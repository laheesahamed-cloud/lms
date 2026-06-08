import Foundation

struct QuizzesListResponse: Decodable {
    let quizzes: [QuizSummary]

    enum CodingKeys: String, CodingKey {
        case quizzes
        case items
        case data
    }

    init(from decoder: Decoder) throws {
        if let list = try? [QuizSummary](from: decoder) {
            quizzes = list
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        quizzes = (try? container.decodeIfPresent([QuizSummary].self, forKey: .quizzes))
            ?? (try? container.decodeIfPresent([QuizSummary].self, forKey: .items))
            ?? (try? container.decodeIfPresent([QuizSummary].self, forKey: .data))
            ?? []
    }
}

struct QuizSummary: Decodable, Identifiable, Hashable {
    let id: Int
    let title: String
    let description: String?
    let questionCount: Int?
    let durationMinutes: Int?
    let mode: String?
    let subject: String?
    let courseTitle: String?
    let isBookmarked: Bool?
    let lastAttemptScore: Double?
    let lastAttemptId: Int?
    let canAccess: Bool
    let accessLocked: Bool
    let accessMessage: String?
    let canPracticeMode: Bool
    let canExamMode: Bool
    let examModeOnly: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case studentTitle
        case quizTitle
        case name
        case description
        case quizDescription
        case questionCount
        case questionCountSnake = "question_count"
        case totalQuestions
        case durationMinutes
        case durationMinutesSnake = "duration_minutes"
        case timeLimit
        case mode
        case subject
        case subjectName
        case courseTitle
        case isBookmarked
        case isBookmarkedSnake = "is_bookmarked"
        case lastAttemptScore
        case lastAttemptScoreSnake = "last_attempt_score"
        case lastAttemptId
        case lastAttemptIdSnake = "last_attempt_id"
        case canAccess
        case accessLocked
        case accessMessage
        case canPracticeMode
        case canExamMode
        case examModeOnly
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        title = container.decodeString(for: [.studentTitle, .quizTitle, .title, .name]) ?? "Quiz"
        description = container.decodeString(for: [.quizDescription, .description])
        questionCount = container.decodeInt(for: [.totalQuestions, .questionCount, .questionCountSnake])
        durationMinutes = container.decodeInt(for: [.timeLimit, .durationMinutes, .durationMinutesSnake])
        mode = container.decodeString(for: [.mode])
        subject = container.decodeString(for: [.subjectName, .subject])
        courseTitle = container.decodeString(for: [.courseTitle])
        isBookmarked = container.decodeBool(for: [.isBookmarked, .isBookmarkedSnake])
        lastAttemptScore = container.decodeDouble(for: [.lastAttemptScore, .lastAttemptScoreSnake])
        lastAttemptId = container.decodeInt(for: [.lastAttemptId, .lastAttemptIdSnake])
        canAccess = container.decodeBool(for: [.canAccess]) ?? true
        accessLocked = container.decodeBool(for: [.accessLocked]) ?? false
        accessMessage = container.decodeString(for: [.accessMessage])
        canPracticeMode = container.decodeBool(for: [.canPracticeMode]) ?? true
        canExamMode = container.decodeBool(for: [.canExamMode]) ?? true
        examModeOnly = container.decodeBool(for: [.examModeOnly]) ?? false
    }
}

struct QuizLoadResponse: Decodable {
    let mode: String?
    let questions: [QuizQuestion]
    let metadata: QuizMetadata?
    let practiceSession: QuizSessionState?
    let examSession: QuizSessionState?

    enum CodingKeys: String, CodingKey {
        case mode
        case questions
        case quiz
        case metadata
        case practiceSession
        case examSession
        case practice_session
        case exam_session
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        mode = container.decodeString(for: [.mode])
        questions = (try? container.decodeIfPresent([QuizQuestion].self, forKey: .questions)) ?? []
        metadata = (try? container.decodeIfPresent(QuizMetadata.self, forKey: .quiz))
            ?? (try? container.decodeIfPresent(QuizMetadata.self, forKey: .metadata))
        practiceSession = (try? container.decodeIfPresent(QuizSessionState.self, forKey: .practiceSession))
            ?? (try? container.decodeIfPresent(QuizSessionState.self, forKey: .practice_session))
        examSession = (try? container.decodeIfPresent(QuizSessionState.self, forKey: .examSession))
            ?? (try? container.decodeIfPresent(QuizSessionState.self, forKey: .exam_session))
    }

    var activeSession: QuizSessionState? {
        if mode == QuizMode.exam.rawValue {
            return examSession ?? practiceSession
        }
        return practiceSession ?? examSession
    }
}

struct QuizMetadata: Decodable {
    let quizId: Int
    let title: String
    let mode: String?
    let durationMinutes: Int?
    let questionCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case quizId
        case quizIdSnake = "quiz_id"
        case title
        case studentTitle
        case quizTitle
        case mode
        case durationMinutes
        case durationMinutesSnake = "duration_minutes"
        case timeLimit
        case questionCount
        case questionCountSnake = "question_count"
        case totalQuestions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        quizId = container.decodeInt(for: [.quizId, .quizIdSnake, .id]) ?? 0
        title = container.decodeString(for: [.studentTitle, .quizTitle, .title]) ?? "Quiz"
        mode = container.decodeString(for: [.mode])
        durationMinutes = container.decodeInt(for: [.timeLimit, .durationMinutes, .durationMinutesSnake])
        questionCount = container.decodeInt(for: [.totalQuestions, .questionCount, .questionCountSnake]) ?? 0
    }
}

struct QuizSessionState: Decodable {
    let answers: [String: QuizAnswerValue]?
    let currentQuestionIndex: Int?
    let revealedQuestionIds: [Int]?
    let flaggedQuestionIds: [Int]?

    enum CodingKeys: String, CodingKey {
        case answers
        case draftAnswers
        case draft_answers
        case currentQuestionIndex
        case currentQuestionIndexSnake = "current_question_index"
        case revealedQuestionIds
        case revealedQuestionIdsSnake = "revealed_question_ids"
        case flaggedQuestionIds
        case flaggedQuestionIdsSnake = "flagged_question_ids"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        answers = (try? container.decodeIfPresent([String: QuizAnswerValue].self, forKey: .answers))
            ?? (try? container.decodeIfPresent([String: QuizAnswerValue].self, forKey: .draftAnswers))
            ?? (try? container.decodeIfPresent([String: QuizAnswerValue].self, forKey: .draft_answers))
        currentQuestionIndex = container.decodeInt(for: [.currentQuestionIndex, .currentQuestionIndexSnake])
        revealedQuestionIds = (try? container.decodeIfPresent([Int].self, forKey: .revealedQuestionIds))
            ?? (try? container.decodeIfPresent([Int].self, forKey: .revealedQuestionIdsSnake))
        flaggedQuestionIds = (try? container.decodeIfPresent([Int].self, forKey: .flaggedQuestionIds))
            ?? (try? container.decodeIfPresent([Int].self, forKey: .flaggedQuestionIdsSnake))
    }
}

struct QuizQuestion: Decodable, Identifiable {
    let id: Int
    let text: String
    let questionType: String
    let imageKey: String?
    let explanation: String?
    let options: [QuizOption]
    let answerKey: QuizAnswerKey?
    let theoryRecap: QuickTheoryRecap?
    let canRevealAnswer: Bool?
    let savedAnswer: QuizSavedAnswer?

    enum CodingKeys: String, CodingKey {
        case id
        case text
        case questionText
        case question_text
        case questionType
        case question_type
        case type
        case imageKey
        case image_key
        case explanation
        case options
        case answerKey
        case answer_key
        case theoryRecap
        case theory_recap
        case canRevealAnswer
        case can_reveal_answer
        case savedAnswer
        case saved_answer
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        text = container.decodeString(for: [.questionText, .question_text, .text]) ?? ""
        questionType = container.decodeString(for: [.questionType, .question_type, .type]) ?? "sba"
        imageKey = container.decodeString(for: [.imageKey, .image_key])
        explanation = container.decodeString(for: [.explanation])
        options = (try? container.decodeIfPresent([QuizOption].self, forKey: .options)) ?? []
        answerKey = (try? container.decodeIfPresent(QuizAnswerKey.self, forKey: .answerKey))
            ?? (try? container.decodeIfPresent(QuizAnswerKey.self, forKey: .answer_key))
        theoryRecap = (try? container.decodeIfPresent(QuickTheoryRecap.self, forKey: .theoryRecap))
            ?? (try? container.decodeIfPresent(QuickTheoryRecap.self, forKey: .theory_recap))
        canRevealAnswer = container.decodeBool(for: [.canRevealAnswer, .can_reveal_answer])
        savedAnswer = (try? container.decodeIfPresent(QuizSavedAnswer.self, forKey: .savedAnswer))
            ?? (try? container.decodeIfPresent(QuizSavedAnswer.self, forKey: .saved_answer))
    }

    var isTrueFalse: Bool {
        let normalized = questionType.lowercased().replacingOccurrences(of: "-", with: "_")
        return normalized == "true_false" || normalized == "truefalse" || normalized == "tf"
    }

    var backendQuestionType: String {
        isTrueFalse ? "true_false" : "sba"
    }

    var hasLearningSupport: Bool {
        let hasExplanation = !(explanation ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasDistractors = options.contains { !($0.whyIncorrect ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        return hasExplanation || hasDistractors || theoryRecap?.hasContent == true
    }
}

struct QuizSavedAnswer: Decodable, Equatable {
    let selectedIds: [Int]
    let tfMap: [String: Bool]

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
            tfMap = boolMap
        } else if let intMap = (try? container.decodeIfPresent([String: Int].self, forKey: .tfMap))
            ?? (try? container.decodeIfPresent([String: Int].self, forKey: .tf_map)) {
            tfMap = intMap.mapValues { $0 != 0 }
        } else if let stringMap = (try? container.decodeIfPresent([String: String].self, forKey: .tfMap))
            ?? (try? container.decodeIfPresent([String: String].self, forKey: .tf_map)) {
            tfMap = stringMap.compactMapValues { raw in
                let normalized = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if ["1", "true", "yes"].contains(normalized) { return true }
                if ["0", "false", "no"].contains(normalized) { return false }
                return nil
            }
        } else {
            tfMap = [:]
        }
    }
}

struct QuizOption: Decodable, Identifiable {
    let id: Int
    let text: String
    let label: String?
    let imageKey: String?
    let isCorrect: Bool?
    let whyIncorrect: String?

    enum CodingKeys: String, CodingKey {
        case id
        case text
        case optionText
        case option_text
        case label
        case optionLabel
        case option_label
        case imageKey
        case image_key
        case isCorrect
        case is_correct
        case correct
        case whyIncorrect
        case why_incorrect
        case explanation
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        text = container.decodeString(for: [.optionText, .option_text, .text]) ?? ""
        label = container.decodeString(for: [.optionLabel, .option_label, .label])
        imageKey = container.decodeString(for: [.imageKey, .image_key])
        isCorrect = container.decodeBool(for: [.isCorrect, .is_correct, .correct])
        whyIncorrect = container.decodeString(for: [.whyIncorrect, .why_incorrect, .explanation])
    }
}

struct QuizAnswerKey: Decodable {
    let type: String?
    let correctOptions: [QuizAnswerKeyOption]
    let statements: [QuizAnswerKeyStatement]

    enum CodingKeys: String, CodingKey {
        case type
        case correctOptions
        case correct_options
        case statements
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = container.decodeString(for: [.type])
        correctOptions = (try? container.decodeIfPresent([QuizAnswerKeyOption].self, forKey: .correctOptions))
            ?? (try? container.decodeIfPresent([QuizAnswerKeyOption].self, forKey: .correct_options))
            ?? []
        statements = (try? container.decodeIfPresent([QuizAnswerKeyStatement].self, forKey: .statements)) ?? []
    }
}

struct QuizAnswerKeyOption: Decodable, Identifiable {
    let optionId: Int
    let label: String?
    let text: String?

    var id: Int { optionId }

    enum CodingKeys: String, CodingKey {
        case optionId
        case option_id
        case id
        case label
        case text
        case optionText
        case option_text
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        optionId = container.decodeInt(for: [.optionId, .option_id, .id]) ?? 0
        label = container.decodeString(for: [.label])
        text = container.decodeString(for: [.optionText, .option_text, .text])
    }
}

struct QuizAnswerKeyStatement: Decodable, Identifiable {
    let optionId: Int
    let label: String?
    let text: String?
    let answer: String?

    var id: Int { optionId }

    enum CodingKeys: String, CodingKey {
        case optionId
        case option_id
        case id
        case label
        case text
        case optionText
        case option_text
        case answer
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        optionId = container.decodeInt(for: [.optionId, .option_id, .id]) ?? 0
        label = container.decodeString(for: [.label])
        text = container.decodeString(for: [.optionText, .option_text, .text])
        answer = container.decodeString(for: [.answer])
    }
}

struct QuickTheoryRecap: Decodable, Equatable {
    let conceptName: String?
    let hierarchy: QuickTheoryHierarchy?
    let etiology: [String]
    let pathophysiology: [String]
    let clinicalFeatures: [String]
    let investigations: [String]
    let treatment: [String]
    let keyPoints: [String]
    let mnemonic: String?

    enum CodingKeys: String, CodingKey {
        case conceptName
        case concept_name
        case hierarchy
        case hierarchyCourse
        case hierarchy_course
        case hierarchySubject
        case hierarchy_subject
        case hierarchyTopic
        case hierarchy_topic
        case hierarchyLesson
        case hierarchy_lesson
        case etiology
        case pathophysiology
        case clinicalFeatures
        case clinical_features
        case investigations
        case treatment
        case keyPoints
        case key_points
        case mnemonic
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        conceptName = container.decodeString(for: [.conceptName, .concept_name])
        hierarchy = (try? container.decodeIfPresent(QuickTheoryHierarchy.self, forKey: .hierarchy))
            ?? QuickTheoryHierarchy(
                course: container.decodeString(for: [.hierarchyCourse, .hierarchy_course]),
                subject: container.decodeString(for: [.hierarchySubject, .hierarchy_subject]),
                topic: container.decodeString(for: [.hierarchyTopic, .hierarchy_topic]),
                lesson: container.decodeString(for: [.hierarchyLesson, .hierarchy_lesson])
            )
        etiology = container.decodeStringArray(for: [.etiology])
        pathophysiology = container.decodeStringArray(for: [.pathophysiology])
        clinicalFeatures = container.decodeStringArray(for: [.clinicalFeatures, .clinical_features])
        investigations = container.decodeStringArray(for: [.investigations])
        treatment = container.decodeStringArray(for: [.treatment])
        keyPoints = container.decodeStringArray(for: [.keyPoints, .key_points])
        mnemonic = container.decodeString(for: [.mnemonic])
    }

    init(
        conceptName: String? = nil,
        hierarchy: QuickTheoryHierarchy? = nil,
        etiology: [String] = [],
        pathophysiology: [String] = [],
        clinicalFeatures: [String] = [],
        investigations: [String] = [],
        treatment: [String] = [],
        keyPoints: [String] = [],
        mnemonic: String? = nil
    ) {
        self.conceptName = conceptName
        self.hierarchy = hierarchy
        self.etiology = etiology
        self.pathophysiology = pathophysiology
        self.clinicalFeatures = clinicalFeatures
        self.investigations = investigations
        self.treatment = treatment
        self.keyPoints = keyPoints
        self.mnemonic = mnemonic
    }

    var hasContent: Bool {
        [
            etiology,
            pathophysiology,
            clinicalFeatures,
            investigations,
            treatment,
            keyPoints
        ].contains { !$0.isEmpty }
        || !(mnemonic ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        || !(conceptName ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

struct QuickTheoryHierarchy: Decodable, Equatable {
    let course: String?
    let subject: String?
    let topic: String?
    let lesson: String?
}

enum QuizAnswerValue: Codable, Equatable {
    case single(Int)
    case trueFalse([String: Bool])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(Int.self) {
            self = .single(value)
            return
        }
        if let value = try? container.decode(String.self), let intValue = Int(value) {
            self = .single(intValue)
            return
        }
        if let value = try? container.decode([String: Bool].self) {
            self = .trueFalse(value)
            return
        }
        if let value = try? container.decode([String: Int].self) {
            self = .trueFalse(value.mapValues { $0 != 0 })
            return
        }
        self = .trueFalse([:])
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .single(let value):
            try container.encode(value)
        case .trueFalse(let value):
            try container.encode(value.mapValues { $0 ? 1 : 0 })
        }
    }
}

struct SavePracticeAnswerRequest: Encodable {
    let questionId: Int
    let questionIndex: Int
    let questionType: String
    let selected: [Int]?
    let tfAnswers: [String: Int]?
}

struct SaveDraftRequest: Encodable {
    let answers: [String: QuizAnswerValue]
    let currentQuestionIndex: Int
    let revealedQuestionIds: [Int]?
}

struct SaveExamRequest: Encodable {
    let answers: [String: QuizAnswerValue]
    let currentQuestionIndex: Int
    let flaggedQuestionIds: [Int]?
}

struct SubmitExamRequest: Encodable {
    let answers: [String: QuizAnswerValue]
}

struct PracticeRevealResponse: Decodable {
    let question: QuizQuestion

    enum CodingKeys: String, CodingKey {
        case question
    }

    init(from decoder: Decoder) throws {
        if let direct = try? QuizQuestion(from: decoder) {
            question = direct
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        question = try container.decode(QuizQuestion.self, forKey: .question)
    }
}

struct QuestionReportRequest: Encodable {
    let questionId: Int
    let reason: String
    let comment: String?
}

struct QuestionReportResponse: Decodable {
    let ok: Bool?
    let id: Int?
    let questionId: Int?
}

struct FinishAttemptResponse: Decodable {
    let result: AttemptResult?
    let attemptId: Int?
    let sessionId: Int?
    let success: Bool?
    let ok: Bool?

    enum CodingKeys: String, CodingKey {
        case result
        case attempt
        case attemptId
        case attempt_id
        case sessionId
        case session_id
        case success
        case ok
    }

    init(from decoder: Decoder) throws {
        let container = try? decoder.container(keyedBy: CodingKeys.self)
        result = (try? container?.decodeIfPresent(AttemptResult.self, forKey: .result))
            ?? (try? container?.decodeIfPresent(AttemptResult.self, forKey: .attempt))
            ?? (try? AttemptResult(from: decoder))
        attemptId = container?.decodeInt(for: [.attemptId, .attempt_id])
        sessionId = container?.decodeInt(for: [.sessionId, .session_id])
        success = container?.decodeBool(for: [.success])
        ok = container?.decodeBool(for: [.ok])
    }
}

struct SubmitExamResponse: Decodable {
    let result: AttemptResult?
    let attemptId: Int?
    let success: Bool?
    let ok: Bool?

    enum CodingKeys: String, CodingKey {
        case result
        case attempt
        case attemptId
        case attempt_id
        case success
        case ok
    }

    init(from decoder: Decoder) throws {
        let container = try? decoder.container(keyedBy: CodingKeys.self)
        result = (try? container?.decodeIfPresent(AttemptResult.self, forKey: .result))
            ?? (try? container?.decodeIfPresent(AttemptResult.self, forKey: .attempt))
            ?? (try? AttemptResult(from: decoder))
        attemptId = container?.decodeInt(for: [.attemptId, .attempt_id]) ?? result?.id
        success = container?.decodeBool(for: [.success])
        ok = container?.decodeBool(for: [.ok])
    }
}

private extension KeyedDecodingContainer {
    func decodeString(for keys: [Key]) -> String? {
        for key in keys {
            if let value = try? decodeIfPresent(String.self, forKey: key) {
                return value
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
                if ["1", "true", "yes"].contains(normalized) { return true }
                if ["0", "false", "no"].contains(normalized) { return false }
            }
        }
        return nil
    }

    func decodeStringArray(for keys: [Key]) -> [String] {
        for key in keys {
            if let value = try? decodeIfPresent([String].self, forKey: key) {
                return value.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            }
            if let value = try? decodeIfPresent([Int].self, forKey: key) {
                return value.map(String.init)
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
        return []
    }
}
