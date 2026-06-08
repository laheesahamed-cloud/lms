import Foundation

struct PlannerTasksResponse: Decodable {
    let tasks: [PlannerTask]?

    enum CodingKeys: String, CodingKey {
        case tasks
    }

    init(from decoder: Decoder) throws {
        if let list = try? decoder.singleValueContainer().decode([PlannerTask].self) {
            tasks = list
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        tasks = try container.decodeIfPresent([PlannerTask].self, forKey: .tasks)
    }
}

struct PlannerAgendaResponse: Decodable {
    let agenda: [AgendaItem]?
    let generatedAt: String?
    let summary: PlannerAgendaSummary?

    enum CodingKeys: String, CodingKey {
        case agenda
        case items
        case generatedAt
        case summary
    }

    init(from decoder: Decoder) throws {
        if let list = try? decoder.singleValueContainer().decode([AgendaItem].self) {
            agenda = list
            generatedAt = nil
            summary = nil
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        agenda = try container.decodeIfPresent([AgendaItem].self, forKey: .items)
            ?? container.decodeIfPresent([AgendaItem].self, forKey: .agenda)
        generatedAt = container.decodeString(for: [.generatedAt])
        summary = try container.decodeIfPresent(PlannerAgendaSummary.self, forKey: .summary)
    }
}

struct PlannerAgendaSummary: Decodable {
    let dueToday: Int?
    let overdue: Int?
    let inProgress: Int?
    let upcoming: Int?
    let completed: Int?

    enum CodingKeys: String, CodingKey {
        case dueToday
        case overdue
        case inProgress
        case upcoming
        case completed
    }
}

struct PlannerTask: Decodable, Identifiable {
    let id: Int
    let title: String
    let description: String?
    let dueDate: String?
    let status: String?
    let category: String?
    let priority: String?
    let estimatedMinutes: Int?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case dueDate
        case dueDateSnake = "due_date"
        case status
        case category
        case priority
        case estimatedMinutes
        case estimatedMinutesSnake = "estimated_minutes"
        case createdAt
        case createdAtSnake = "created_at"
        case updatedAt
        case updatedAtSnake = "updated_at"
        case isCompleted
        case isCompletedSnake = "is_completed"
        case subject
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeInt(for: [.id]) ?? 0
        title = container.decodeString(for: [.title]) ?? "Study task"
        description = container.decodeString(for: [.description])
        dueDate = container.decodeString(for: [.dueDate, .dueDateSnake])
        let decodedStatus = container.decodeString(for: [.status])
        if decodedStatus == nil, let isCompleted = container.decodeBool(for: [.isCompleted, .isCompletedSnake]) {
            status = isCompleted ? "done" : "todo"
        } else {
            status = decodedStatus
        }
        category = container.decodeString(for: [.category]) ?? container.decodeString(for: [.subject])
        priority = container.decodeString(for: [.priority])
        estimatedMinutes = container.decodeInt(for: [.estimatedMinutes, .estimatedMinutesSnake])
        createdAt = container.decodeString(for: [.createdAt, .createdAtSnake])
        updatedAt = container.decodeString(for: [.updatedAt, .updatedAtSnake])
    }

    var isCompleted: Bool {
        let normalized = (status ?? "").lowercased()
        return normalized == "done" || normalized == "completed"
    }
}

struct AgendaItem: Decodable, Identifiable {
    let id: String
    let source: String?
    let sourceId: Int?
    let title: String
    let dueDate: String?
    let type: String?
    let status: String?
    let course: String?
    let subject: String?
    let topic: String?
    let lesson: String?
    let progress: Double?
    let actionLabel: String?
    let locked: Bool?
    let accessMessage: String?
    let priority: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case source
        case sourceId
        case title
        case dueDate
        case dueDateSnake = "due_date"
        case dueAt
        case type
        case status
        case course
        case subject
        case topic
        case lesson
        case progress
        case actionLabel
        case locked
        case accessMessage
        case priority
        case isCompleted
        case isCompletedSnake = "is_completed"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = container.decodeString(for: [.id]) ?? "\(container.decodeInt(for: [.id]) ?? 0)"
        source = container.decodeString(for: [.source])
        sourceId = container.decodeInt(for: [.sourceId])
        title = container.decodeString(for: [.title]) ?? "Planner item"
        dueDate = container.decodeString(for: [.dueAt, .dueDate, .dueDateSnake])
        type = container.decodeString(for: [.type])
        let decodedStatus = container.decodeString(for: [.status])
        if decodedStatus == nil, let isCompleted = container.decodeBool(for: [.isCompleted, .isCompletedSnake]) {
            status = isCompleted ? "completed" : "upcoming"
        } else {
            status = decodedStatus
        }
        course = container.decodeString(for: [.course])
        subject = container.decodeString(for: [.subject])
        topic = container.decodeString(for: [.topic])
        lesson = container.decodeString(for: [.lesson])
        progress = container.decodeDouble(for: [.progress])
        actionLabel = container.decodeString(for: [.actionLabel])
        locked = container.decodeBool(for: [.locked])
        accessMessage = container.decodeString(for: [.accessMessage])
        priority = container.decodeInt(for: [.priority])
    }

    var isCompleted: Bool {
        (status ?? "").lowercased() == "completed"
    }

    var contextLine: String? {
        let parts = [course, subject, topic, lesson]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && $0.caseInsensitiveCompare(title) != .orderedSame }
        let unique = parts.reduce(into: [String]()) { result, part in
            if !result.contains(where: { $0.caseInsensitiveCompare(part) == .orderedSame }) {
                result.append(part)
            }
        }
        return unique.isEmpty ? nil : unique.joined(separator: " / ")
    }
}

struct CreatePlannerTaskRequest: Encodable {
    let title: String
    let description: String?
    let dueDate: String?
    let category: String?
    let priority: String?
    let estimatedMinutes: Int?
}

struct UpdatePlannerTaskRequest: Encodable {
    let title: String?
    let description: String?
    let dueDate: String?
    let status: String?
    let category: String?
    let priority: String?
    let estimatedMinutes: Int?
}

struct EmptyAPIResponse: Decodable {}

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
