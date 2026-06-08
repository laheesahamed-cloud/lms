import Foundation

// Maps push notification payloads and URL schemes to AppRoute.
// Push payloads contain a "route" string mirroring web routes like "/ai-notes/5"
enum DeepLinkHandler {
    static func resolve(route: String) -> AppRoute? {
        let parts = route.split(separator: "/").map(String.init)
        guard !parts.isEmpty else { return nil }

        switch parts[0] {
        case "dashboard": return .dashboard
        case "courses":
            if parts.count > 1, let id = Int(parts[1]) { return .courseDetail(id: id) }
            return .courses
        case "ai-notes":
            if parts.count > 1, let id = Int(parts[1]) { return .aiNoteDetail(id: id) }
            return .notes
        case "study":
            if parts.count > 2, parts[1] == "lesson", let id = Int(parts[2]) {
                return .lessonNoteDetail(lessonId: id)
            }
            return nil
        case "quizzes", "exams":
            if parts.count > 1, let id = Int(parts[1]) {
                let mode: QuizMode = parts[0] == "exams" ? .exam : .practice
                return .takeQuiz(id: id, mode: mode)
            }
            return .quizzes
        case "results":
            if parts.count > 1, let id = Int(parts[1]) { return .resultDetail(attemptId: id) }
            return .resultsList
        case "review":
            if parts.count > 1, let id = Int(parts[1]) { return .reviewWorkspace(attemptId: id) }
            return nil
        case "flashcards": return .flashcards
        case "bookmarks": return .bookmarks
        case "planner": return .planner
        case "notifications": return .notifications
        case "subscriptions": return .billing
        case "profile": return .profile
        default: return nil
        }
    }
}
