import Foundation

@MainActor
final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let baseURL: String
    private let decoder: JSONDecoder

    // Set externally by AuthSession on sign-in / sign-out
    var authToken: String?
    // Called by AuthSession when any request returns 401
    var onUnauthorized: (() -> Void)?

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        self.session = URLSession(configuration: config)
        self.baseURL = APIClient.resolvedBaseURL()
        self.decoder = JSONDecoder()
    }

    // MARK: - Core request

    func request<T: Decodable>(
        _ endpoint: APIEndpoint,
        body: (any Encodable)? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        let urlRequest = try buildRequest(endpoint, body: body, queryItems: queryItems)
        let (data, response) = try await perform(urlRequest)
        try validateStatus(response, data: data, endpoint: endpoint)
        return try decode(T.self, from: data)
    }

    // Variant for endpoints that return no meaningful body (e.g. 204)
    func requestVoid(_ endpoint: APIEndpoint, body: (any Encodable)? = nil) async throws {
        let urlRequest = try buildRequest(endpoint, body: body)
        let (data, response) = try await perform(urlRequest)
        try validateStatus(response, data: data, endpoint: endpoint)
    }

    // MARK: - Build

    private func buildRequest(
        _ endpoint: APIEndpoint,
        body: (any Encodable)? = nil,
        queryItems: [URLQueryItem]? = nil
    ) throws -> URLRequest {
        guard var components = URLComponents(string: baseURL + endpoint.path) else {
            throw APIError.invalidURL
        }
        if let queryItems { components.queryItems = queryItems }

        guard let url = components.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if endpoint.requiresAuth, let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if endpoint.requiresNativeHeader {
            request.setValue("1", forHTTPHeaderField: "X-LMS-Native")
        }

        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        return request
    }

    // MARK: - Perform

    private func perform(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.unknown(nil)
            }
            return (data, httpResponse)
        } catch let urlError as URLError {
            if urlError.code == .notConnectedToInternet || urlError.code == .networkConnectionLost {
                throw APIError.networkUnavailable
            }
            throw APIError.unknown(urlError)
        }
    }

    // MARK: - Validate

    private func validateStatus(_ response: HTTPURLResponse, data: Data, endpoint: APIEndpoint) throws {
        switch response.statusCode {
        case 200...299:
            return
        case 401:
            onUnauthorized?()
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 400...499:
            let message = extractMessage(from: data)
            throw APIError.serverError(response.statusCode, message)
        case 500...599:
            let message = extractMessage(from: data)
            throw APIError.serverError(response.statusCode, message)
        default:
            throw APIError.unknown(nil)
        }
    }

    // MARK: - Decode

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIError.decodingFailed(error)
        }
    }

    // MARK: - Helpers

    private func extractMessage(from data: Data) -> String? {
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let message = json["message"] as? String {
                return message
            }
            if let messages = json["message"] as? [String] {
                return messages.joined(separator: "\n")
            }
            if let error = json["error"] as? String {
                return error
            }
        }
        return nil
    }

    private static func resolvedBaseURL() -> String {
        // Read from Info.plist key API_BASE_URL; fall back to local dev
        if let url = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           !url.isEmpty {
            return url
        }
        return "https://xyndrome.lk/api"
    }
}
