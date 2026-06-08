import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case notFound
    case forbidden
    case serverError(Int, String?)
    case decodingFailed(Error)
    case networkUnavailable
    case invalidURL
    case unknown(Error?)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Your session has expired. Please sign in again."
        case .notFound:
            return "The requested content could not be found."
        case .forbidden:
            return "You don't have permission to access this."
        case .serverError(_, let message):
            return message ?? "Something went wrong. Please try again."
        case .decodingFailed:
            return "Received unexpected data from the server."
        case .networkUnavailable:
            return "No internet connection. Please check your network."
        case .invalidURL:
            return "Invalid request. Please try again."
        case .unknown:
            return "An unexpected error occurred. Please try again."
        }
    }

    var isUnauthorized: Bool {
        if case .unauthorized = self { return true }
        return false
    }
}
