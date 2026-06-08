import Foundation

struct BookmarksResponse: Decodable {
    let bookmarks: [Bookmark]?

    enum CodingKeys: String, CodingKey {
        case bookmarks
    }

    init(from decoder: Decoder) throws {
        if let list = try? decoder.singleValueContainer().decode([Bookmark].self) {
            bookmarks = list
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        bookmarks = try container.decodeIfPresent([Bookmark].self, forKey: .bookmarks)
    }
}

struct Bookmark: Decodable, Identifiable {
    let id: Int
    let itemType: String
    let itemId: Int
    let title: String?
    let examModeOnly: Bool?
    let engineKey: String?
    let quizId: Int?
    let courseTitle: String?
    let topicName: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case itemType
        case itemTypeSnake = "item_type"
        case type
        case itemId
        case itemIdSnake = "item_id"
        case refId = "ref_id"
        case title
        case subject
        case examModeOnly
        case examModeOnlySnake = "exam_mode_only"
        case engineKey
        case engineKeySnake = "engine_key"
        case quizId
        case quizIdSnake = "quiz_id"
        case courseTitle
        case courseTitleSnake = "course_title"
        case topicName
        case topicNameSnake = "topic_name"
        case createdAt
        case createdAtSnake = "created_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        itemType = container.decodeString(for: [.itemType, .itemTypeSnake, .type]) ?? "ai_note"
        itemId = container.decodeInt(for: [.itemId, .itemIdSnake, .refId]) ?? 0
        title = container.decodeString(for: [.title])
        examModeOnly = container.decodeBool(for: [.examModeOnly, .examModeOnlySnake])
        engineKey = container.decodeString(for: [.engineKey, .engineKeySnake])
        quizId = container.decodeInt(for: [.quizId, .quizIdSnake])
        courseTitle = container.decodeString(for: [.courseTitle, .courseTitleSnake])
        topicName = container.decodeString(for: [.topicName, .topicNameSnake]) ?? container.decodeString(for: [.subject])
        createdAt = container.decodeString(for: [.createdAt, .createdAtSnake])
    }

    var isExam: Bool {
        itemType == "quiz" && examModeOnly == true
    }

    var isNote: Bool {
        itemType == "ai_note" || itemType == "note"
    }

    var displayType: String {
        if isExam { return "Exam" }
        if itemType == "quiz" { return "Quiz" }
        if itemType == "question" { return "Question" }
        return "Note"
    }

    var actionLabel: String {
        if isExam { return "Start exam" }
        if itemType == "quiz" { return "Practice" }
        return "Open"
    }

    var displayTitle: String {
        let cleanTitle = (title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return cleanTitle.isEmpty ? "\(displayType) #\(itemId)" : cleanTitle
    }

    var contextLine: String? {
        let parts = [courseTitle, topicName]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && $0.caseInsensitiveCompare(displayTitle) != .orderedSame }
        let unique = parts.reduce(into: [String]()) { result, part in
            if !result.contains(where: { $0.caseInsensitiveCompare(part) == .orderedSame }) {
                result.append(part)
            }
        }
        return unique.isEmpty ? nil : unique.joined(separator: " / ")
    }
}

struct ToggleBookmarkRequest: Encodable {
    let itemType: String
    let itemId: Int
}

struct ToggleBookmarkResponse: Decodable {
    let ok: Bool?
    let saved: Bool?
    let bookmarked: Bool?

    var isSaved: Bool? {
        saved ?? bookmarked
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
