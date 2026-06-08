import Foundation

enum AppRoute: Hashable {
    // Auth
    case login
    case register
    case forgotPassword
    case resetPassword(token: String)

    // Student tabs (root destinations)
    case dashboard
    case courses
    case quizzes
    case notes
    case profile

    // Courses
    case courseDetail(id: Int)

    // Notes
    case aiNoteDetail(id: Int)
    case lessonNoteDetail(lessonId: Int)

    // Quizzes
    case takeQuiz(id: Int, mode: QuizMode)
    case practiceReview(attemptId: Int)

    // Results
    case resultsList
    case resultDetail(attemptId: Int)
    case reviewWorkspace(attemptId: Int)

    // Flashcards
    case flashcards
    case flashcardDetail(noteId: Int)

    // Bookmarks
    case bookmarks

    // Planner
    case planner

    // Notifications
    case notifications

    // Billing
    case billing
    case checkout(planId: Int)

    // Pending account
    case pending
}

enum QuizMode: String, Hashable {
    case practice
    case exam
}
