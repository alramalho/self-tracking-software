import Foundation

class APIService {
    static let shared = APIService()
    private let baseUrl = "https://api.tracking.so"

    private init() {}

    func fetchActivities() async throws -> [Activity] {
        guard let token = await AuthManager.shared.getValidToken() else {
            throw APIError.unauthorized
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
            await AuthManager.shared.clearTokens()
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
            throw APIError.unauthorized
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
            ("quantity", String(quantity)),
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
            await AuthManager.shared.clearTokens()
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode(ActivityEntry.self, from: data)
    }
}

enum APIError: LocalizedError {
    case unauthorized
    case invalidURL
    case invalidResponse
    case serverError(Int)

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Please sign in again"
        case .invalidURL: return "Invalid URL"
        case .invalidResponse: return "Invalid response"
        case .serverError(let code): return "Server error (\(code))"
        }
    }
}
