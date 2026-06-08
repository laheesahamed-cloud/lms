import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case put = "PUT"
    case delete = "DELETE"
}

enum APIEndpoint {
    // Auth
    case login
    case register
    case me
    case logout
    case forgotPassword
    case resetPassword
    case updateProfile
    case changePassword

    // Dashboard
    case studentDashboard
    case recordActivity

    // Courses
    case studentCourses
    case studentCourseDetail(id: Int)
    case updateLessonProgress(lessonId: Int)

    // Lesson notebooks
    case listStudentLessons
    case getStudentLesson(id: Int)
    case listLessonAnnotations(lessonId: Int)
    case createLessonAnnotation(lessonId: Int)
    case updateLessonAnnotation(lessonId: Int, annotationId: Int)
    case deleteLessonAnnotation(lessonId: Int, annotationId: Int)

    // AI Notes
    case listAiNotes
    case getAiNote(id: Int)
    case getLessonAiNote(lessonId: Int)

    // Quiz Attempts
    case listQuizzes
    case listResults
    case loadQuiz(id: Int)
    case savePracticeAnswer(id: Int)
    case savePracticeDraft(id: Int)
    case finishPractice(id: Int)
    case revealPracticeAnswer(quizId: Int, questionId: Int)
    case submitExam(id: Int)
    case saveExam(id: Int)
    case getResult(attemptId: Int)
    case getReview(attemptId: Int)
    case completeReview(attemptId: Int)
    case getPracticeReview(attemptId: Int)
    case reportQuestion

    // Bookmarks
    case listBookmarks
    case toggleBookmark

    // Notifications
    case listNotifications
    case markNotificationRead(id: Int)
    case registerNativePushToken
    case unregisterNativePushToken

    // Planner
    case listPlannerTasks
    case plannerAgenda
    case createPlannerTask
    case updatePlannerTask(id: Int)
    case deletePlannerTask(id: Int)

    // Billing
    case mySubscription
    case requestSubscription
    case initiatePayHere
    case requestManualPayment
    case cancelSubscriptionRequest(id: Int)

    var method: HTTPMethod {
        switch self {
        case .login, .register, .logout, .forgotPassword, .resetPassword,
             .recordActivity, .createLessonAnnotation, .savePracticeAnswer, .savePracticeDraft,
             .finishPractice, .submitExam, .saveExam, .completeReview,
             .reportQuestion, .toggleBookmark, .markNotificationRead, .registerNativePushToken,
             .createPlannerTask, .requestSubscription, .initiatePayHere,
             .requestManualPayment:
            return .post
        case .updateProfile, .changePassword, .updateLessonProgress,
             .updateLessonAnnotation, .updatePlannerTask:
            return .patch
        case .unregisterNativePushToken, .cancelSubscriptionRequest,
             .deleteLessonAnnotation, .deletePlannerTask:
            return .delete
        default:
            return .get
        }
    }

    var path: String {
        switch self {
        case .login: return "/auth/login"
        case .register: return "/auth/register"
        case .me: return "/auth/me"
        case .logout: return "/auth/logout"
        case .forgotPassword: return "/auth/forgot-password"
        case .resetPassword: return "/auth/reset-password"
        case .updateProfile: return "/auth/profile"
        case .changePassword: return "/auth/password"

        case .studentDashboard: return "/student/dashboard"
        case .recordActivity: return "/student/dashboard/activity"

        case .studentCourses: return "/student/courses"
        case .studentCourseDetail(let id): return "/student/courses/\(id)"
        case .updateLessonProgress(let lessonId): return "/student/courses/lessons/\(lessonId)/progress"

        case .listStudentLessons: return "/lessons/student"
        case .getStudentLesson(let id): return "/lessons/student/\(id)"
        case .listLessonAnnotations(let lessonId): return "/lessons/\(lessonId)/annotations"
        case .createLessonAnnotation(let lessonId): return "/lessons/\(lessonId)/annotations"
        case .updateLessonAnnotation(let lessonId, let annotationId): return "/lessons/\(lessonId)/annotations/\(annotationId)"
        case .deleteLessonAnnotation(let lessonId, let annotationId): return "/lessons/\(lessonId)/annotations/\(annotationId)"

        case .listAiNotes: return "/student/ai-notes"
        case .getAiNote(let id): return "/student/ai-notes/\(id)"
        case .getLessonAiNote(let lessonId): return "/student/ai-notes/lesson/\(lessonId)"

        case .listQuizzes: return "/student/quiz-attempts/quizzes"
        case .listResults: return "/student/quiz-attempts/results"
        case .loadQuiz(let id): return "/student/quiz-attempts/quiz/\(id)"
        case .savePracticeAnswer(let id): return "/student/quiz-attempts/practice/\(id)/save"
        case .savePracticeDraft(let id): return "/student/quiz-attempts/practice/\(id)/draft"
        case .finishPractice(let id): return "/student/quiz-attempts/practice/\(id)/finish"
        case .revealPracticeAnswer(let quizId, let questionId): return "/student/quiz-attempts/practice/\(quizId)/answer/\(questionId)/reveal"
        case .submitExam(let id): return "/student/quiz-attempts/exam/\(id)/submit"
        case .saveExam(let id): return "/student/quiz-attempts/exam/\(id)/save"
        case .getResult(let id): return "/student/quiz-attempts/result/\(id)"
        case .getReview(let id): return "/student/quiz-attempts/review/\(id)"
        case .completeReview(let id): return "/student/quiz-attempts/review/\(id)/complete"
        case .getPracticeReview(let id): return "/student/quiz-attempts/practice-review/\(id)"
        case .reportQuestion: return "/student/question-reports"

        case .listBookmarks: return "/student/bookmarks"
        case .toggleBookmark: return "/student/bookmarks/toggle"

        case .listNotifications: return "/student/notifications"
        case .markNotificationRead(let id): return "/student/notifications/\(id)/read"
        case .registerNativePushToken: return "/push/native-token"
        case .unregisterNativePushToken: return "/push/native-token"

        case .listPlannerTasks: return "/student/planner"
        case .plannerAgenda: return "/student/planner/agenda"
        case .createPlannerTask: return "/student/planner"
        case .updatePlannerTask(let id): return "/student/planner/\(id)"
        case .deletePlannerTask(let id): return "/student/planner/\(id)"

        case .mySubscription: return "/subscriptions/me"
        case .requestSubscription: return "/subscriptions/request"
        case .initiatePayHere: return "/subscriptions/payhere/initiate"
        case .requestManualPayment: return "/subscriptions/manual-payment/request"
        case .cancelSubscriptionRequest(let id): return "/subscriptions/requests/\(id)"
        }
    }

    var requiresAuth: Bool {
        switch self {
        case .login, .register, .forgotPassword, .resetPassword:
            return false
        default:
            return true
        }
    }

    var requiresNativeHeader: Bool {
        switch self {
        case .login, .register:
            return true
        default:
            return false
        }
    }
}
