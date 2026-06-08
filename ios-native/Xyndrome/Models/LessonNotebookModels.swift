import Foundation

struct LessonNotebooksResponse: Decodable {
    let lessons: [LessonNotebook]

    enum CodingKeys: String, CodingKey {
        case lessons
        case items
        case data
        case result
    }

    init(from decoder: Decoder) throws {
        if let list = try? decoder.singleValueContainer().decode([LessonNotebook].self) {
            lessons = list
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        lessons = (try? container.decodeIfPresent([LessonNotebook].self, forKey: .lessons))
            ?? (try? container.decodeIfPresent([LessonNotebook].self, forKey: .items))
            ?? (try? container.decodeIfPresent([LessonNotebook].self, forKey: .data))
            ?? (try? container.decodeIfPresent([LessonNotebook].self, forKey: .result))
            ?? []
    }
}

struct LessonNotebookDetailResponse: Decodable {
    let lesson: LessonNotebook

    enum CodingKeys: String, CodingKey {
        case lesson
        case item
        case data
        case result
    }

    init(from decoder: Decoder) throws {
        if let direct = try? LessonNotebook(from: decoder) {
            lesson = direct
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let wrapped = (try? container.decodeIfPresent(LessonNotebook.self, forKey: .lesson))
            ?? (try? container.decodeIfPresent(LessonNotebook.self, forKey: .item))
            ?? (try? container.decodeIfPresent(LessonNotebook.self, forKey: .data))
            ?? (try? container.decodeIfPresent(LessonNotebook.self, forKey: .result)) {
            lesson = wrapped
            return
        }

        throw DecodingError.dataCorrupted(
            DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Lesson notebook payload is missing")
        )
    }
}

struct LessonNotebook: Decodable, Identifiable, Equatable {
    let id: Int
    let courseId: Int?
    let topicId: Int?
    let subtopicId: Int?
    let lessonTitle: String
    let lessonContent: String
    let videoUrl: String?
    let isFree: Bool
    let status: String?
    let createdAt: String?
    let updatedAt: String?
    let courseTitle: String?
    let topicName: String?
    let subtopicName: String?
    let excerpt: String?
    let canAccess: Bool
    let accessLocked: Bool
    let lockReason: String?

    var displayTitle: String {
        subtopicName.notebookNonEmpty ?? lessonTitle
    }

    var contextLine: String {
        [courseTitle, topicName, subtopicName]
            .compactMap { $0.notebookNonEmpty }
            .joined(separator: " • ")
    }

    enum CodingKeys: String, CodingKey {
        case id
        case courseId
        case course_id
        case topicId
        case topic_id
        case subtopicId
        case subtopic_id
        case lessonTitle
        case lesson_title
        case title
        case lessonContent
        case lesson_content
        case content
        case videoUrl
        case video_url
        case isFree
        case is_free
        case status
        case createdAt
        case created_at
        case updatedAt
        case updated_at
        case courseTitle
        case course_title
        case topicName
        case topic_name
        case subtopicName
        case subtopic_name
        case excerpt
        case canAccess
        case accessLocked
        case lockReason
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.notebookInt(for: [.id]) ?? 0
        courseId = container.notebookInt(for: [.courseId, .course_id])
        topicId = container.notebookInt(for: [.topicId, .topic_id])
        subtopicId = container.notebookInt(for: [.subtopicId, .subtopic_id])
        lessonTitle = container.notebookString(for: [.lessonTitle, .lesson_title, .title]) ?? "Lesson"
        lessonContent = container.notebookString(for: [.lessonContent, .lesson_content, .content]) ?? ""
        videoUrl = container.notebookString(for: [.videoUrl, .video_url]).notebookNonEmpty
        isFree = container.notebookBool(for: [.isFree, .is_free]) ?? false
        status = container.notebookString(for: [.status])
        createdAt = container.notebookString(for: [.createdAt, .created_at])
        updatedAt = container.notebookString(for: [.updatedAt, .updated_at])
        courseTitle = container.notebookString(for: [.courseTitle, .course_title])
        topicName = container.notebookString(for: [.topicName, .topic_name])
        subtopicName = container.notebookString(for: [.subtopicName, .subtopic_name])
        excerpt = container.notebookString(for: [.excerpt])
        canAccess = container.notebookBool(for: [.canAccess]) ?? true
        if let locked = container.notebookBool(for: [.accessLocked]) {
            accessLocked = locked
        } else {
            accessLocked = !canAccess
        }
        lockReason = container.notebookString(for: [.lockReason])
    }
}

struct LessonAnnotationsResponse: Decodable {
    let annotations: [LessonAnnotation]

    enum CodingKeys: String, CodingKey {
        case annotations
        case notes
        case items
        case data
        case result
    }

    init(from decoder: Decoder) throws {
        if let list = try? decoder.singleValueContainer().decode([LessonAnnotation].self) {
            annotations = list
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        annotations = (try? container.decodeIfPresent([LessonAnnotation].self, forKey: .annotations))
            ?? (try? container.decodeIfPresent([LessonAnnotation].self, forKey: .notes))
            ?? (try? container.decodeIfPresent([LessonAnnotation].self, forKey: .items))
            ?? (try? container.decodeIfPresent([LessonAnnotation].self, forKey: .data))
            ?? (try? container.decodeIfPresent([LessonAnnotation].self, forKey: .result))
            ?? []
    }
}

struct LessonAnnotation: Decodable, Identifiable, Equatable {
    let id: Int
    let lessonId: Int
    let userId: Int?
    let type: String
    let selectedText: String
    let startOffset: Int
    let endOffset: Int
    let color: String
    let noteText: String
    let createdAt: String?
    let updatedAt: String?

    var isNote: Bool {
        type == "note"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case lessonId
        case lesson_id
        case userId
        case user_id
        case type
        case selectedText
        case selected_text
        case startOffset
        case start_offset
        case endOffset
        case end_offset
        case color
        case noteText
        case note_text
        case createdAt
        case created_at
        case updatedAt
        case updated_at
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.notebookInt(for: [.id]) ?? 0
        lessonId = container.notebookInt(for: [.lessonId, .lesson_id]) ?? 0
        userId = container.notebookInt(for: [.userId, .user_id])
        type = container.notebookString(for: [.type]) ?? "note"
        selectedText = container.notebookString(for: [.selectedText, .selected_text]) ?? ""
        startOffset = container.notebookInt(for: [.startOffset, .start_offset]) ?? 0
        endOffset = container.notebookInt(for: [.endOffset, .end_offset]) ?? startOffset
        color = container.notebookString(for: [.color]) ?? "#c7d2fe"
        noteText = container.notebookString(for: [.noteText, .note_text]) ?? ""
        createdAt = container.notebookString(for: [.createdAt, .created_at])
        updatedAt = container.notebookString(for: [.updatedAt, .updated_at])
    }
}

struct LessonTextSelection: Equatable {
    let selectedText: String
    let startOffset: Int
    let endOffset: Int
}

enum LessonNoteComposerMode: String, Equatable {
    case create
    case edit
}

struct LessonNoteComposer: Equatable {
    var mode: LessonNoteComposerMode
    var annotationId: Int?
    var selectedText: String
    var startOffset: Int?
    var endOffset: Int?
    var noteText: String

    static var empty: LessonNoteComposer {
        LessonNoteComposer(
            mode: .create,
            annotationId: nil,
            selectedText: "",
            startOffset: nil,
            endOffset: nil,
            noteText: ""
        )
    }

    var isEditing: Bool {
        mode == .edit
    }
}

struct CreateLessonAnnotationRequest: Encodable {
    let type: String
    let selectedText: String
    let startOffset: Int
    let endOffset: Int
    let color: String
    let noteText: String
}

struct UpdateLessonAnnotationRequest: Encodable {
    let color: String
    let noteText: String
}

enum StudentNotesNativeAPI {
    @MainActor
    static func listLessons() async throws -> [LessonNotebook] {
        let response: LessonNotebooksResponse = try await APIClient.shared.request(.listStudentLessons)
        return response.lessons
    }

    @MainActor
    static func getLesson(id: Int) async throws -> LessonNotebook {
        let response: LessonNotebookDetailResponse = try await APIClient.shared.request(.getStudentLesson(id: id))
        return response.lesson
    }

    @MainActor
    static func listAnnotations(lessonId: Int) async throws -> [LessonAnnotation] {
        let response: LessonAnnotationsResponse = try await APIClient.shared.request(.listLessonAnnotations(lessonId: lessonId))
        return response.annotations
    }

    @MainActor
    static func createAnnotation(lessonId: Int, request: CreateLessonAnnotationRequest) async throws {
        let _: LessonAnnotation = try await APIClient.shared.request(.createLessonAnnotation(lessonId: lessonId), body: request)
    }

    @MainActor
    static func updateAnnotation(lessonId: Int, annotationId: Int, request: UpdateLessonAnnotationRequest) async throws {
        let _: LessonAnnotation = try await APIClient.shared.request(
            .updateLessonAnnotation(lessonId: lessonId, annotationId: annotationId),
            body: request
        )
    }

    @MainActor
    static func deleteAnnotation(lessonId: Int, annotationId: Int) async throws {
        try await APIClient.shared.requestVoid(.deleteLessonAnnotation(lessonId: lessonId, annotationId: annotationId))
    }
}

private extension KeyedDecodingContainer {
    func notebookString(for keys: [Key]) -> String? {
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

    func notebookInt(for keys: [Key]) -> Int? {
        for key in keys {
            if let value = try? decodeIfPresent(Int.self, forKey: key) {
                return value
            }
            if let value = try? decodeIfPresent(Double.self, forKey: key) {
                return Int(value)
            }
            if let value = try? decodeIfPresent(String.self, forKey: key),
               let number = Int(value.trimmingCharacters(in: .whitespacesAndNewlines)) {
                return number
            }
        }
        return nil
    }

    func notebookBool(for keys: [Key]) -> Bool? {
        for key in keys {
            if let value = try? decodeIfPresent(Bool.self, forKey: key) {
                return value
            }
            if let value = try? decodeIfPresent(Int.self, forKey: key) {
                return value != 0
            }
            if let value = try? decodeIfPresent(Double.self, forKey: key) {
                return value != 0
            }
            if let value = try? decodeIfPresent(String.self, forKey: key) {
                let lowered = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if ["true", "1", "yes"].contains(lowered) {
                    return true
                }
                if ["false", "0", "no"].contains(lowered) {
                    return false
                }
            }
        }
        return nil
    }
}

private extension Optional where Wrapped == String {
    var notebookNonEmpty: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }
}
