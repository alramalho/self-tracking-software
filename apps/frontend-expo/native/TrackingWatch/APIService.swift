import Foundation

class APIService {
    static let shared = APIService()
    private let baseUrl = "https://api.tracking.so"

    private init() {}

    func fetchActivities() async throws -> [Activity] {
        guard let token = await AuthManager.shared.getValidToken() else {
            throw await AuthManager.shared.isAuthenticated ? APIError.temporarilyUnavailable : APIError.unauthorized
        }

        guard let url = URL(string: "\(baseUrl)/activities/") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            await MainActor.run {
                if AuthManager.shared.accessToken == token { AuthManager.shared.clearTokens() }
            }
            throw APIError.unauthorized
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode([Activity].self, from: data)
    }

    func logActivity(activityId: String, quantity: Double) async throws -> ActivityEntry {
        guard let token = await AuthManager.shared.getValidToken() else {
            throw await AuthManager.shared.isAuthenticated ? APIError.temporarilyUnavailable : APIError.unauthorized
        }

        guard let url = URL(string: "\(baseUrl)/activities/log-activity") else {
            throw APIError.invalidURL
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let isoDate = formatter.string(from: Date())

        let timeZone = TimeZone.current.identifier

        let boundary = UUID().uuidString
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        let fields: [(String, String)] = [
            ("activityId", activityId),
            ("iso_date_string", isoDate),
            ("quantity", String(Int(quantity))),
            ("isPublic", "false"),
            ("timezone", timeZone),
        ]

        for (key, value) in fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            await MainActor.run {
                if AuthManager.shared.accessToken == token { AuthManager.shared.clearTokens() }
            }
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode(ActivityEntry.self, from: data)
    }

    func previewVoiceLog(
        audioURL: URL,
        timezone: String,
        clientRequestId: String,
        refinementContext: VoiceLogRefinementContext? = nil
    ) async throws -> VoiceLogPreview {
        guard let token = await AuthManager.shared.getValidToken() else {
            throw await AuthManager.shared.isAuthenticated ? APIError.temporarilyUnavailable : APIError.unauthorized
        }
        guard let url = URL(string: "\(baseUrl)/voice-logs/preview") else {
            throw APIError.invalidURL
        }

        let audioData = try Data(contentsOf: audioURL)
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func appendField(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }
        appendField("audio_format", "m4a")
        appendField("timezone", timezone)
        appendField("client_request_id", clientRequestId)
        if let refinementContext {
            let contextData = try JSONEncoder().encode(refinementContext)
            guard let context = String(data: contextData, encoding: .utf8) else {
                throw APIError.invalidResponse
            }
            appendField("refinement_context", context)
        }
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"audio_file\"; filename=\"voice-note.m4a\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/mp4\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        if httpResponse.statusCode == 401 {
            await clearTokensIfNeeded(token)
            throw APIError.unauthorized
        }
        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }
        return try JSONDecoder().decode(VoiceLogPreview.self, from: data)
    }

    func commitVoiceLog(_ payload: VoiceLogCommitRequest) async throws -> VoiceLogCommitResponse {
        guard let token = await AuthManager.shared.getValidToken() else {
            throw await AuthManager.shared.isAuthenticated ? APIError.temporarilyUnavailable : APIError.unauthorized
        }
        guard let url = URL(string: "\(baseUrl)/voice-logs/commit") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        if httpResponse.statusCode == 401 {
            await clearTokensIfNeeded(token)
            throw APIError.unauthorized
        }
        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }
        return try JSONDecoder().decode(VoiceLogCommitResponse.self, from: data)
    }

    private func clearTokensIfNeeded(_ token: String) async {
        await MainActor.run {
            if AuthManager.shared.accessToken == token {
                AuthManager.shared.clearTokens()
            }
        }
    }
}

enum APIError: LocalizedError {
    case unauthorized
    case temporarilyUnavailable
    case invalidURL
    case invalidResponse
    case serverError(Int)

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Please sign in again"
        case .temporarilyUnavailable: return "Could not connect. Check your connection and retry."
        case .invalidURL: return "Invalid URL"
        case .invalidResponse: return "Invalid response"
        case .serverError(let code): return "Server error (\(code))"
        }
    }
}
