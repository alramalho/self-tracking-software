import Foundation

struct Activity: Codable, Identifiable {
    let id: String
    let userId: String
    let title: String
    let emoji: String
    let measure: String
    let colorHex: String
    let createdAt: String
    let deletedAt: String?
}

struct ActivityEntry: Codable, Identifiable {
    let id: String
    let activityId: String
    let userId: String
    let quantity: Double
    let datetime: String
    let description: String?
    let createdAt: String
}

struct LogActivityRequest: Encodable {
    let activityId: String
    let iso_date_string: String
    let quantity: Double
    let isPublic: Bool
    let timezone: String
}

struct AppleSignInResponse: Codable {
    let user: AppleSignInUser
    let verificationUrl: String
}

struct AppleSignInUser: Codable {
    let id: String
    let email: String
}

struct TokenResponse: Codable {
    let access_token: String
    let refresh_token: String
    let token_type: String?
    let expires_in: Int?
}
