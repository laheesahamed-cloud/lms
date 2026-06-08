import Foundation

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct RegisterRequest: Encodable {
    let fullName: String
    let email: String
    let password: String
    let confirmPassword: String
    let acceptedTerms: Bool
}

struct ForgotPasswordRequest: Encodable {
    let email: String
}

struct ResetPasswordRequest: Encodable {
    let token: String
    let newPassword: String
    let confirmPassword: String
}

struct UpdateProfileRequest: Encodable {
    let fullName: String?
    let avatarKey: String?
}

struct ChangePasswordRequest: Encodable {
    let currentPassword: String
    let newPassword: String
    let confirmPassword: String
}

struct AuthResponse: Decodable {
    let sessionToken: String?
    let sessionTtlDays: Int?
    let user: User?
    let ok: Bool?
    let redirectPath: String?
    let message: String?
}

struct User: Codable, Identifiable {
    let id: Int
    let fullName: String
    let email: String
    let role: String
    let status: String
    let avatarKey: String?

    enum CodingKeys: String, CodingKey {
        case id
        case fullName
        case fullNameSnake = "full_name"
        case email
        case role
        case status
        case avatarKey
        case avatarKeySnake = "avatar_key"
    }

    init(
        id: Int,
        fullName: String,
        email: String,
        role: String,
        status: String,
        avatarKey: String?
    ) {
        self.id = id
        self.fullName = fullName
        self.email = email
        self.role = role
        self.status = status
        self.avatarKey = avatarKey
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        fullName = try container.decodeIfPresent(String.self, forKey: .fullName)
            ?? container.decodeIfPresent(String.self, forKey: .fullNameSnake)
            ?? ""
        email = try container.decodeIfPresent(String.self, forKey: .email) ?? ""
        role = try container.decodeIfPresent(String.self, forKey: .role) ?? "student"
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "active"
        avatarKey = try container.decodeIfPresent(String.self, forKey: .avatarKey)
            ?? container.decodeIfPresent(String.self, forKey: .avatarKeySnake)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(fullName, forKey: .fullName)
        try container.encode(email, forKey: .email)
        try container.encode(role, forKey: .role)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(avatarKey, forKey: .avatarKey)
    }

    var isPending: Bool { status == "pending" }
    var isStudent: Bool { role == "student" }
    var isAdmin: Bool { role == "admin" }
}

struct CurrentUserResponse: Decodable {
    let user: User?
    let ok: Bool?
}

struct SimpleOkResponse: Decodable {
    let ok: Bool?
    let message: String?
}
