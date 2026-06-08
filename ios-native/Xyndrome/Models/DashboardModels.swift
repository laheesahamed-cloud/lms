import Foundation

struct DashboardResponse: Decodable {
    let stats: DashboardStats?
    let goals: [StudyGoal]?
    let performance: PerformanceSummary?
    let recentCourses: [Course]?
    let upcomingTasks: [AgendaItem]?
    let serverClock: DashboardServerClock?
    let totalQuizzes: Int?
    let totalCourses: Int?
    let totalAttempts: Int?
    let quizDayStreak: Int?
    let avgScore: Double?
    let totalPassed: Int?
    let passRate: Double?
    let totalSmartNotes: Int?
    let generatedSmartNotes: Int?
    let courseProgressSummary: CourseProgressSummary?
    let recentAttempts: [DashboardAttempt]?
    let recentSmartNotes: [DashboardSmartNote]?
    let topicMastery: [DashboardTopicInsight]?
    let weakTopics: [DashboardTopicInsight]?
    let strongTopics: [DashboardTopicInsight]?
    let dailyGoalsCompleted: Int?
    let focusTopic: String?
    let focusCourse: String?
    let adaptivePlan: [StudyPlanItem]?
    let questionOfDay: DashboardQuestion?
    let missedPatterns: [DashboardMissedPattern]?
    let progressTone: String?
    let progressNote: String?

    enum CodingKeys: String, CodingKey {
        case stats
        case goals
        case dailyGoals
        case performance
        case performanceSnapshot
        case recentCourses
        case recentCoursesSnake = "recent_courses"
        case courseProgress
        case upcomingTasks
        case upcomingTasksSnake = "upcoming_tasks"
        case serverClock
        case totalQuizzes
        case totalCourses
        case quizDayStreak
        case totalAttempts
        case avgScore
        case totalPassed
        case passRate
        case totalSmartNotes
        case generatedSmartNotes
        case courseProgressSummary
        case recentAttempts
        case recentSmartNotes
        case topicMastery
        case weakTopics
        case strongTopics
        case dailyGoalsCompleted
        case focusTopic
        case focusCourse
        case adaptivePlan
        case questionOfDay
        case missedPatterns
        case progressTone
        case progressNote
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        totalQuizzes = container.decodeInt(for: [.totalQuizzes])
        totalCourses = container.decodeInt(for: [.totalCourses])
        totalAttempts = container.decodeInt(for: [.totalAttempts])
        quizDayStreak = container.decodeInt(for: [.quizDayStreak])
        avgScore = container.decodeDouble(for: [.avgScore])
        totalPassed = container.decodeInt(for: [.totalPassed])
        passRate = container.decodeDouble(for: [.passRate])
        totalSmartNotes = container.decodeInt(for: [.totalSmartNotes])
        generatedSmartNotes = container.decodeInt(for: [.generatedSmartNotes])
        stats = try container.decodeIfPresent(DashboardStats.self, forKey: .stats)
            ?? DashboardStats(
                studyStreakDays: quizDayStreak,
                totalStudyMinutes: nil,
                quizzesCompleted: totalAttempts,
                averageScore: avgScore,
                notesRead: totalSmartNotes
            )
        goals = try container.decodeIfPresent([StudyGoal].self, forKey: .goals)
            ?? container.decodeIfPresent([StudyGoal].self, forKey: .dailyGoals)
        performance = try container.decodeIfPresent(PerformanceSummary.self, forKey: .performance)
            ?? container.decodeIfPresent(PerformanceSummary.self, forKey: .performanceSnapshot)
        recentCourses = try container.decodeIfPresent([Course].self, forKey: .recentCourses)
            ?? container.decodeIfPresent([Course].self, forKey: .recentCoursesSnake)
            ?? container.decodeIfPresent([Course].self, forKey: .courseProgress)
        upcomingTasks = try container.decodeIfPresent([AgendaItem].self, forKey: .upcomingTasks)
            ?? container.decodeIfPresent([AgendaItem].self, forKey: .upcomingTasksSnake)
        serverClock = try container.decodeIfPresent(DashboardServerClock.self, forKey: .serverClock)
        courseProgressSummary = try container.decodeIfPresent(CourseProgressSummary.self, forKey: .courseProgressSummary)
        recentAttempts = try container.decodeIfPresent([DashboardAttempt].self, forKey: .recentAttempts)
        recentSmartNotes = try container.decodeIfPresent([DashboardSmartNote].self, forKey: .recentSmartNotes)
        topicMastery = try container.decodeIfPresent([DashboardTopicInsight].self, forKey: .topicMastery)
        weakTopics = try container.decodeIfPresent([DashboardTopicInsight].self, forKey: .weakTopics)
        strongTopics = try container.decodeIfPresent([DashboardTopicInsight].self, forKey: .strongTopics)
        dailyGoalsCompleted = container.decodeInt(for: [.dailyGoalsCompleted])
        focusTopic = container.decodeString(for: [.focusTopic])
        focusCourse = container.decodeString(for: [.focusCourse])
        adaptivePlan = try container.decodeIfPresent([StudyPlanItem].self, forKey: .adaptivePlan)
        questionOfDay = try container.decodeIfPresent(DashboardQuestion.self, forKey: .questionOfDay)
        missedPatterns = try container.decodeIfPresent([DashboardMissedPattern].self, forKey: .missedPatterns)
        progressTone = container.decodeString(for: [.progressTone])
        progressNote = container.decodeString(for: [.progressNote])
    }
}

struct DashboardStats: Decodable {
    let studyStreakDays: Int?
    let totalStudyMinutes: Int?
    let quizzesCompleted: Int?
    let averageScore: Double?
    let notesRead: Int?

    enum CodingKeys: String, CodingKey {
        case studyStreakDays
        case studyStreakDaysSnake = "study_streak_days"
        case totalStudyMinutes
        case totalStudyMinutesSnake = "total_study_minutes"
        case quizzesCompleted
        case quizzesCompletedSnake = "quizzes_completed"
        case averageScore
        case averageScoreSnake = "average_score"
        case notesRead
        case notesReadSnake = "notes_read"
    }

    init(
        studyStreakDays: Int?,
        totalStudyMinutes: Int?,
        quizzesCompleted: Int?,
        averageScore: Double?,
        notesRead: Int?
    ) {
        self.studyStreakDays = studyStreakDays
        self.totalStudyMinutes = totalStudyMinutes
        self.quizzesCompleted = quizzesCompleted
        self.averageScore = averageScore
        self.notesRead = notesRead
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        studyStreakDays = container.decodeInt(for: [.studyStreakDays, .studyStreakDaysSnake])
        totalStudyMinutes = container.decodeInt(for: [.totalStudyMinutes, .totalStudyMinutesSnake])
        quizzesCompleted = container.decodeInt(for: [.quizzesCompleted, .quizzesCompletedSnake])
        averageScore = container.decodeDouble(for: [.averageScore, .averageScoreSnake])
        notesRead = container.decodeInt(for: [.notesRead, .notesReadSnake])
    }
}

struct StudyGoal: Decodable, Identifiable {
    let id: Int
    let key: String?
    let title: String
    let description: String?
    let targetValue: Int?
    let currentValue: Int?
    let unit: String?
    let completed: Bool?
    let progressText: String?
    let actionType: String?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case id
        case key
        case title
        case description
        case unit
        case targetValue
        case targetValueSnake = "target_value"
        case currentValue
        case currentValueSnake = "current_value"
        case completed
        case progressText
        case actionType
        case status
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        key = container.decodeString(for: [.key])
        let stableKey = key ?? container.decodeString(for: [.title]) ?? UUID().uuidString
        id = container.decodeInt(for: [.id]) ?? stableKey.stablePositiveHash
        title = container.decodeString(for: [.title]) ?? "Study goal"
        description = container.decodeString(for: [.description])
        targetValue = container.decodeInt(for: [.targetValue, .targetValueSnake])
        currentValue = container.decodeInt(for: [.currentValue, .currentValueSnake])
        unit = container.decodeString(for: [.unit])
        completed = container.decodeBool(for: [.completed])
        progressText = container.decodeString(for: [.progressText])
        actionType = container.decodeString(for: [.actionType])
        status = container.decodeString(for: [.status])
    }

    var progress: Double {
        if completed == true { return 1 }
        guard let target = targetValue, let current = currentValue, target > 0 else { return 0 }
        return min(Double(current) / Double(target), 1.0)
    }
}

struct PerformanceSummary: Decodable {
    let weeklyScores: [Double]?
    let topSubject: String?
    let improvementAreas: [String]?
    let readinessScore: Int?
    let trendLabel: String?
    let weeklyAttempts: Int?
    let weeklyAverage: Double?
    let previousWeeklyAverage: Double?
    let scoreDelta: Int?
    let scoreTrend: String?
    let readinessLabel: String?
    let consistencyLabel: String?
    let windowLabel: String?
    let comparisonLabel: String?
    let dateRangeLabel: String?
    let sourceLabel: String?
    let emptyState: String?

    enum CodingKeys: String, CodingKey {
        case weeklyScores
        case weeklyScoresSnake = "weekly_scores"
        case topSubject
        case topSubjectSnake = "top_subject"
        case improvementAreas
        case improvementAreasSnake = "improvement_areas"
        case readinessScore
        case trendLabel
        case weeklyAttempts
        case weeklyAverage
        case previousWeeklyAverage
        case scoreDelta
        case scoreTrend
        case readinessLabel
        case consistencyLabel
        case windowLabel
        case comparisonLabel
        case dateRangeLabel
        case sourceLabel
        case emptyState
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        weeklyScores = (try? container.decodeIfPresent([Double].self, forKey: .weeklyScores))
            ?? (try? container.decodeIfPresent([Double].self, forKey: .weeklyScoresSnake))
        topSubject = container.decodeString(for: [.topSubject, .topSubjectSnake])
        improvementAreas = (try? container.decodeIfPresent([String].self, forKey: .improvementAreas))
            ?? (try? container.decodeIfPresent([String].self, forKey: .improvementAreasSnake))
        readinessScore = container.decodeInt(for: [.readinessScore])
        trendLabel = container.decodeString(for: [.trendLabel])
        weeklyAttempts = container.decodeInt(for: [.weeklyAttempts])
        weeklyAverage = container.decodeDouble(for: [.weeklyAverage])
        previousWeeklyAverage = container.decodeDouble(for: [.previousWeeklyAverage])
        scoreDelta = container.decodeInt(for: [.scoreDelta])
        scoreTrend = container.decodeString(for: [.scoreTrend])
        readinessLabel = container.decodeString(for: [.readinessLabel])
        consistencyLabel = container.decodeString(for: [.consistencyLabel])
        windowLabel = container.decodeString(for: [.windowLabel])
        comparisonLabel = container.decodeString(for: [.comparisonLabel])
        dateRangeLabel = container.decodeString(for: [.dateRangeLabel])
        sourceLabel = container.decodeString(for: [.sourceLabel])
        emptyState = container.decodeString(for: [.emptyState])
    }
}

struct DashboardServerClock: Decodable {
    let nowIso: String?
    let dateKey: String?
    let timeZone: String?
    let source: String?

    enum CodingKeys: String, CodingKey {
        case nowIso
        case dateKey
        case timeZone
        case source
    }
}

struct CourseProgressSummary: Decodable {
    let visibleCourses: Int?
    let completedLessons: Int?
    let totalLessons: Int?
    let overallProgressPercent: Double?
    let sourceLabel: String?

    enum CodingKeys: String, CodingKey {
        case visibleCourses
        case completedLessons
        case totalLessons
        case overallProgressPercent
        case sourceLabel
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        visibleCourses = container.decodeInt(for: [.visibleCourses])
        completedLessons = container.decodeInt(for: [.completedLessons])
        totalLessons = container.decodeInt(for: [.totalLessons])
        overallProgressPercent = container.decodeDouble(for: [.overallProgressPercent])
        sourceLabel = container.decodeString(for: [.sourceLabel])
    }
}

struct DashboardAttempt: Decodable, Identifiable {
    let id: Int
    let quizTitle: String
    let courseTitle: String?
    let topicName: String?
    let score: Double?
    let totalQuestions: Int?
    let percentage: Double?
    let passStatus: String?
    let submittedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case attemptId
        case quizTitle
        case quizTitleSnake = "quiz_title"
        case title
        case courseTitle
        case courseTitleSnake = "course_title"
        case topicName
        case topicNameSnake = "topic_name"
        case score
        case totalQuestions
        case totalQuestionsSnake = "total_questions"
        case percentage
        case passStatus
        case passStatusSnake = "pass_status"
        case submittedAt
        case submittedAtSnake = "submitted_at"
        case completedAt
        case createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id, .attemptId]) ?? UUID().uuidString.stablePositiveHash
        quizTitle = container.decodeString(for: [.quizTitle, .quizTitleSnake, .title]) ?? "Quiz attempt"
        courseTitle = container.decodeString(for: [.courseTitle, .courseTitleSnake])
        topicName = container.decodeString(for: [.topicName, .topicNameSnake])
        score = container.decodeDouble(for: [.score])
        totalQuestions = container.decodeInt(for: [.totalQuestions, .totalQuestionsSnake])
        percentage = container.decodeDouble(for: [.percentage])
        passStatus = container.decodeString(for: [.passStatus, .passStatusSnake])
        submittedAt = container.decodeString(for: [.submittedAt, .submittedAtSnake, .completedAt, .createdAt])
    }
}

struct DashboardSmartNote: Decodable, Identifiable {
    let id: Int
    let title: String
    let updatedAt: String?
    let hasVisual: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case updatedAt
        case updatedAtSnake = "updated_at"
        case hasVisual
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? UUID().uuidString.stablePositiveHash
        title = container.decodeString(for: [.title]) ?? "Smart note"
        updatedAt = container.decodeString(for: [.updatedAt, .updatedAtSnake])
        hasVisual = container.decodeBool(for: [.hasVisual])
    }
}

struct DashboardTopicInsight: Decodable, Identifiable {
    let id: Int
    let topicName: String
    let courseTitle: String?
    let averagePercentage: Double?
    let attemptsCount: Int?
    let mastery: String?
    let masteryLabel: String?
    let confidenceLabel: String?

    enum CodingKeys: String, CodingKey {
        case topicName
        case topicNameSnake = "topic_name"
        case courseTitle
        case courseTitleSnake = "course_title"
        case averagePercentage
        case averagePercentageSnake = "average_percentage"
        case attemptsCount
        case attemptsCountSnake = "attempts_count"
        case mastery
        case masteryLabel
        case confidenceLabel
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        topicName = container.decodeString(for: [.topicName, .topicNameSnake]) ?? "General"
        courseTitle = container.decodeString(for: [.courseTitle, .courseTitleSnake])
        averagePercentage = container.decodeDouble(for: [.averagePercentage, .averagePercentageSnake])
        attemptsCount = container.decodeInt(for: [.attemptsCount, .attemptsCountSnake])
        mastery = container.decodeString(for: [.mastery])
        masteryLabel = container.decodeString(for: [.masteryLabel])
        confidenceLabel = container.decodeString(for: [.confidenceLabel])
        id = "\(courseTitle ?? "course"):\(topicName)".stablePositiveHash
    }
}

struct StudyPlanItem: Decodable, Identifiable {
    let id: Int
    let key: String?
    let title: String
    let description: String?
    let actionType: String?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case id
        case key
        case title
        case description
        case actionType
        case status
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        key = container.decodeString(for: [.key])
        let stableKey = key ?? container.decodeString(for: [.title]) ?? UUID().uuidString
        id = container.decodeInt(for: [.id]) ?? stableKey.stablePositiveHash
        title = container.decodeString(for: [.title]) ?? "Study step"
        description = container.decodeString(for: [.description])
        actionType = container.decodeString(for: [.actionType])
        status = container.decodeString(for: [.status])
    }
}

struct DashboardQuestion: Decodable, Identifiable {
    let id: Int
    let questionType: String?
    let questionText: String
    let courseTitle: String?
    let subjectName: String?
    let topicName: String?
    let options: [DashboardQuestionOption]

    enum CodingKeys: String, CodingKey {
        case id
        case questionType
        case questionText
        case courseTitle
        case subjectName
        case topicName
        case options
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? UUID().uuidString.stablePositiveHash
        questionType = container.decodeString(for: [.questionType])
        questionText = container.decodeString(for: [.questionText]) ?? "Question unavailable"
        courseTitle = container.decodeString(for: [.courseTitle])
        subjectName = container.decodeString(for: [.subjectName])
        topicName = container.decodeString(for: [.topicName])
        options = (try? container.decodeIfPresent([DashboardQuestionOption].self, forKey: .options)) ?? []
    }
}

struct DashboardQuestionOption: Decodable, Identifiable {
    let id: Int
    let optionLabel: String?
    let optionText: String
    let isCorrect: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case optionLabel
        case optionText
        case isCorrect
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? UUID().uuidString.stablePositiveHash
        optionLabel = container.decodeString(for: [.optionLabel])
        optionText = container.decodeString(for: [.optionText]) ?? "Option"
        isCorrect = container.decodeBool(for: [.isCorrect])
    }
}

struct DashboardMissedPattern: Decodable, Identifiable {
    let id: Int
    let courseTitle: String?
    let subjectName: String?
    let topicName: String
    let lessonTitle: String?
    let questionType: String?
    let missCount: Int?
    let latestMissedAt: String?
    let patternLabel: String?

    enum CodingKeys: String, CodingKey {
        case courseTitle
        case subjectName
        case topicName
        case lessonTitle
        case questionType
        case missCount
        case latestMissedAt
        case patternLabel
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        courseTitle = container.decodeString(for: [.courseTitle])
        subjectName = container.decodeString(for: [.subjectName])
        topicName = container.decodeString(for: [.topicName]) ?? "General"
        lessonTitle = container.decodeString(for: [.lessonTitle])
        questionType = container.decodeString(for: [.questionType])
        missCount = container.decodeInt(for: [.missCount])
        latestMissedAt = container.decodeString(for: [.latestMissedAt])
        patternLabel = container.decodeString(for: [.patternLabel])
        id = "\(courseTitle ?? "course"):\(subjectName ?? "subject"):\(topicName):\(lessonTitle ?? "lesson")".stablePositiveHash
    }
}

struct RecordActivityRequest: Encodable {
    let activityType: String
    let itemId: Int?
    let eventType: String?
}

private extension String {
    var stablePositiveHash: Int {
        unicodeScalars.reduce(0) { partial, scalar in
            ((partial * 31) + Int(scalar.value)) & 0x7fffffff
        }
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
}
