import Foundation

class APIService {
    static let shared = APIService()
    private let baseUrl = "https://api.tracking.so"

    private init() {}

    func fetchActivities() async throws -> [Activity] {
        guard let url = URL(string: "\(baseUrl)/activities/") else {
            throw APIError.invalidURL
        }

        let (data, httpResponse) = try await send(URLRequest(url: url))

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode([Activity].self, from: data)
    }

    func logActivity(activityId: String, quantity: Double) async throws -> ActivityEntry {
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

        let (data, httpResponse) = try await send(request)

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
        guard let url = URL(string: "\(baseUrl)/voice-logs/preview") else {
            throw APIError.invalidURL
        }

        let audioData = try Data(contentsOf: audioURL)
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
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

        let (data, httpResponse) = try await send(request)
        // Voice notes are transcribed by AI providers; the server refuses
        // until the person allows AI features in the iPhone app.
        if httpResponse.statusCode == 403,
           String(data: data, encoding: .utf8)?.contains("AI_CONSENT_REQUIRED") == true {
            throw APIError.aiConsentRequired
        }
        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }
        return try JSONDecoder().decode(VoiceLogPreview.self, from: data)
    }

    func commitVoiceLog(_ payload: VoiceLogCommitRequest) async throws -> VoiceLogCommitResponse {
        guard let url = URL(string: "\(baseUrl)/voice-logs/commit") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, httpResponse) = try await send(request)
        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(httpResponse.statusCode)
        }
        return try JSONDecoder().decode(VoiceLogCommitResponse.self, from: data)
    }

    /// Sends an authorized request. A rejected token is refreshed and retried once;
    /// only the refresh endpoint decides that the login is gone.
    private func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        guard let token = await AuthManager.shared.getValidToken() else {
            throw await AuthManager.shared.isAuthenticated ? APIError.temporarilyUnavailable : APIError.unauthorized
        }
        let (data, response) = try await send(request, token: token)
        guard response.statusCode == 401 else { return (data, response) }

        guard let renewed = await AuthManager.shared.tokenAfterRejection(of: token) else {
            throw await AuthManager.shared.isAuthenticated ? APIError.temporarilyUnavailable : APIError.unauthorized
        }
        let (retryData, retryResponse) = try await send(request, token: renewed)
        // The login was just renewed, so a second rejection is a server problem.
        guard retryResponse.statusCode != 401 else { throw APIError.temporarilyUnavailable }
        return (retryData, retryResponse)
    }

    private func send(_ request: URLRequest, token: String) async throws -> (Data, HTTPURLResponse) {
        var authorized = request
        authorized.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: authorized)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        return (data, httpResponse)
    }
}

enum APIError: LocalizedError {
    case unauthorized
    case temporarilyUnavailable
    case invalidURL
    case invalidResponse
    case serverError(Int)
    case aiConsentRequired

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Please sign in again"
        case .temporarilyUnavailable: return "Could not connect. Check your connection and retry."
        case .invalidURL: return "Invalid URL"
        case .invalidResponse: return "Invalid response"
        case .serverError(let code): return "Server error (\(code))"
        case .aiConsentRequired: return "Voice notes use AI. Allow AI features in tracking.so on your iPhone first."
        }
    }
}
