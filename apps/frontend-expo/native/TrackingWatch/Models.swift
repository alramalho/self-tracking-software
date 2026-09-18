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

struct VoiceLogActivity: Codable, Identifiable {
    let activityId: String
    let title: String
    let emoji: String
    let measure: String
    var quantity: Int
    let date: String
    let time: String?
    let description: String?
    let privateNotes: String?
    let difficulty: String?
    let confidence: Double

    var id: String { "\(activityId)-\(date)-\(time ?? "day")" }
}

struct VoiceLogMetric: Codable, Identifiable {
    let metricId: String
    let title: String
    let emoji: String
    let rating: Int
    let date: String
    let description: String?
    let confidence: Double

    var id: String { "\(metricId)-\(date)" }
}

struct VoiceLogNote: Codable {
    let title: String
    let text: String
    let date: String
    let confidence: Double
}

struct VoiceLogUnresolved: Codable, Identifiable {
    let text: String
    let reason: String

    var id: String { "\(text)-\(reason)" }
}

struct VoiceLogPreview: Codable {
    let clientRequestId: String
    let transcript: String
    let activities: [VoiceLogActivity]
    let metrics: [VoiceLogMetric]
    let note: VoiceLogNote
    let unresolved: [VoiceLogUnresolved]
}

struct VoiceLogRefinementContext: Encodable {
    let originalTranscript: String
    let currentDraft: VoiceLogPreview
}

struct VoiceLogCommitActivity: Encodable {
    let activityId: String
    let quantity: Int
    let date: String
    let time: String?
    let description: String?
    let privateNotes: String?
    let difficulty: String?
}

struct VoiceLogCommitMetric: Encodable {
    let metricId: String
    let rating: Int
    let date: String
    let description: String?
}

struct VoiceLogCommitRequest: Encodable {
    let clientRequestId: String
    let transcript: String
    let timezone: String
    let activities: [VoiceLogCommitActivity]
    let metrics: [VoiceLogCommitMetric]
    let note: VoiceLogNote
}

struct VoiceLogCommitResponse: Codable {
    let success: Bool
    let duplicate: Bool
    let activityEntryIds: [String]
    let metricEntryIds: [String]
    let noteId: String
}
