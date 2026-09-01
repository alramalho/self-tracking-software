import Foundation

struct Activity: Codable, Identifiable {
    let id: String
    let userId: String
    let title: String
    let emoji: String
    let measure: String
    let colorHex: String?
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

struct WatchTokenResponse: Codable {
    let accessToken: String
    let refreshToken: String
}
