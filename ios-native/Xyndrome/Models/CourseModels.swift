import Foundation

struct CoursesResponse: Decodable {
    let courses: [Course]?

    enum CodingKeys: String, CodingKey {
        case courses
    }

    init(from decoder: Decoder) throws {
        if let list = try? decoder.singleValueContainer().decode([Course].self) {
            courses = list
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        courses = try container.decodeIfPresent([Course].self, forKey: .courses)
    }
}

struct Course: Decodable, Identifiable {
    let id: Int
    let title: String
    let description: String?
    let coverImageKey: String?
    let status: String?
    let lessonsCount: Int?
    let completedLessons: Int?
    let progressPercent: Double?
    let courseCode: String?
    let examType: String?
    let subjectCount: Int?
    let actionLabel: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case courseTitle
        case description
        case status
        case coverImageKey
        case coverImageKeySnake = "cover_image_key"
        case lessonsCount
        case lessonsCountSnake = "lessons_count"
        case totalLessonsCount
        case completedLessons
        case completedLessonsSnake = "completed_lessons"
        case completedLessonsCount
        case progressPercent
        case progressPercentSnake = "progress_percent"
        case courseCode
        case courseCodeSnake = "course_code"
        case examType
        case examTypeSnake = "exam_type"
        case subjectCount
        case actionLabel
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        title = container.decodeString(for: [.title, .courseTitle]) ?? "Course"
        description = container.decodeString(for: [.description])
        coverImageKey = container.decodeString(for: [.coverImageKey, .coverImageKeySnake])
        status = container.decodeString(for: [.status])
        lessonsCount = container.decodeInt(for: [.lessonsCount, .lessonsCountSnake, .totalLessonsCount])
        completedLessons = container.decodeInt(for: [.completedLessons, .completedLessonsSnake, .completedLessonsCount])
        progressPercent = container.decodeDouble(for: [.progressPercent, .progressPercentSnake])
        courseCode = container.decodeString(for: [.courseCode, .courseCodeSnake])
        examType = container.decodeString(for: [.examType, .examTypeSnake])
        subjectCount = container.decodeInt(for: [.subjectCount])
        actionLabel = container.decodeString(for: [.actionLabel])
    }
}

struct CourseDetailResponse: Decodable {
    let course: CourseDetail?
    let subjects: [CourseSubject]?

    enum CodingKeys: String, CodingKey {
        case course
        case subjects
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedSubjects = try container.decodeIfPresent([CourseSubject].self, forKey: .subjects)
        subjects = decodedSubjects
        if let decodedCourse = try container.decodeIfPresent(CourseDetail.self, forKey: .course) {
            course = decodedCourse.withSubjects(decodedSubjects)
        } else {
            course = nil
        }
    }
}

struct CourseDetail: Decodable, Identifiable {
    let id: Int
    let title: String
    let description: String?
    let coverImageKey: String?
    let status: String?
    let progressPercent: Double?
    let completedLessonsCount: Int?
    let totalLessonsCount: Int?
    let subjects: [CourseSubject]?
    let topics: [CourseTopic]?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case courseTitle
        case description
        case status
        case coverImageKey
        case coverImageKeySnake = "cover_image_key"
        case progressPercent
        case completedLessonsCount
        case totalLessonsCount
        case subjects
        case topics
    }

    init(
        id: Int,
        title: String,
        description: String?,
        coverImageKey: String?,
        status: String?,
        progressPercent: Double?,
        completedLessonsCount: Int?,
        totalLessonsCount: Int?,
        subjects: [CourseSubject]?,
        topics: [CourseTopic]?
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.coverImageKey = coverImageKey
        self.status = status
        self.progressPercent = progressPercent
        self.completedLessonsCount = completedLessonsCount
        self.totalLessonsCount = totalLessonsCount
        self.subjects = subjects
        self.topics = topics
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        title = container.decodeString(for: [.title, .courseTitle]) ?? "Course"
        description = container.decodeString(for: [.description])
        coverImageKey = container.decodeString(for: [.coverImageKey, .coverImageKeySnake])
        status = container.decodeString(for: [.status])
        progressPercent = container.decodeDouble(for: [.progressPercent])
        completedLessonsCount = container.decodeInt(for: [.completedLessonsCount])
        totalLessonsCount = container.decodeInt(for: [.totalLessonsCount])
        subjects = try container.decodeIfPresent([CourseSubject].self, forKey: .subjects)
        topics = try container.decodeIfPresent([CourseTopic].self, forKey: .topics)
    }

    func withSubjects(_ subjects: [CourseSubject]?) -> CourseDetail {
        CourseDetail(
            id: id,
            title: title,
            description: description,
            coverImageKey: coverImageKey,
            status: status,
            progressPercent: progressPercent,
            completedLessonsCount: completedLessonsCount,
            totalLessonsCount: totalLessonsCount,
            subjects: subjects ?? self.subjects,
            topics: topics
        )
    }
}

struct CourseSubject: Decodable, Identifiable {
    let id: Int
    let title: String
    let progressPercent: Double?
    let completedLessonsCount: Int?
    let totalLessonsCount: Int?
    let topics: [CourseTopic]

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case subjectName
        case progressPercent
        case completedLessonsCount
        case totalLessonsCount
        case topics
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        title = container.decodeString(for: [.title, .subjectName]) ?? "Subject"
        progressPercent = container.decodeDouble(for: [.progressPercent])
        completedLessonsCount = container.decodeInt(for: [.completedLessonsCount])
        totalLessonsCount = container.decodeInt(for: [.totalLessonsCount])
        topics = try container.decodeIfPresent([CourseTopic].self, forKey: .topics) ?? []
    }
}

struct CourseTopic: Decodable, Identifiable {
    let id: String
    let title: String
    let progressPercent: Double?
    let completedLessonsCount: Int?
    let totalLessonsCount: Int?
    let status: String?
    let lessons: [Lesson]?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case topicName
        case progressPercent
        case completedLessonsCount
        case totalLessonsCount
        case status
        case lessons
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeString(for: [.id]) ?? "\(container.decodeInt(for: [.id]) ?? 0)"
        title = container.decodeString(for: [.title, .topicName]) ?? "Topic"
        progressPercent = container.decodeDouble(for: [.progressPercent])
        completedLessonsCount = container.decodeInt(for: [.completedLessonsCount])
        totalLessonsCount = container.decodeInt(for: [.totalLessonsCount])
        status = container.decodeString(for: [.status])
        lessons = try container.decodeIfPresent([Lesson].self, forKey: .lessons)
    }
}

struct Lesson: Decodable, Identifiable {
    let id: Int
    let title: String
    let type: String?
    let duration: Int?
    let isCompleted: Bool?
    let isLocked: Bool?
    let status: String?
    let progressPercent: Double?
    let actionLabel: String?
    let accessMessage: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case lessonTitle
        case type
        case lessonType
        case duration
        case isCompleted
        case isCompletedSnake = "is_completed"
        case isLocked
        case isLockedSnake = "is_locked"
        case accessLocked
        case canAccess
        case status
        case progressPercent
        case actionLabel
        case accessMessage
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        title = container.decodeString(for: [.title, .lessonTitle]) ?? "Lesson"
        type = container.decodeString(for: [.type, .lessonType])
        duration = container.decodeInt(for: [.duration])
        status = container.decodeString(for: [.status])
        progressPercent = container.decodeDouble(for: [.progressPercent])
        actionLabel = container.decodeString(for: [.actionLabel])
        accessMessage = container.decodeString(for: [.accessMessage])
        isCompleted = container.decodeBool(for: [.isCompleted, .isCompletedSnake])
            ?? (status == "completed" || (progressPercent ?? 0) >= 100)
        if let accessLocked = container.decodeBool(for: [.accessLocked]) {
            isLocked = accessLocked
        } else if let canAccess = container.decodeBool(for: [.canAccess]) {
            isLocked = !canAccess
        } else {
            isLocked = container.decodeBool(for: [.isLocked, .isLockedSnake])
        }
    }
}

struct LessonProgressRequest: Encodable {
    let status: String
    let progressPercent: Int
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
