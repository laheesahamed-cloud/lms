import Foundation

struct NotificationsResponse: Decodable {
    let notifications: [AppNotification]?
}

struct AppNotification: Decodable, Identifiable {
    let id: Int
    let title: String
    let body: String?
    let type: String?
    let isRead: Bool?
    let createdAt: String?
    let route: String?

    enum CodingKeys: String, CodingKey {
        case id, title, body, type, route
        case isRead = "is_read"
        case createdAt = "created_at"
    }
}

struct NativePushTokenRequest: Encodable {
    let token: String
    let platform: String
}
