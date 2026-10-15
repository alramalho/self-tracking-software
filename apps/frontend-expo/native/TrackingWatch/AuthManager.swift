import Foundation

@MainActor
class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var accessToken: String?
    @Published private(set) var accountID: String?

    private let accessKeychain = TokenKeychain(service: "so.tracking.app.watch.access")
    private let refreshKeychain = TokenKeychain(service: "so.tracking.app.watch.refresh")
    private let lastChangeKey = "lastPhoneAuthUpdate"
    private let backendUrl = "https://api.tracking.so"
    private var revision = 0
    private var refreshTask: Task<String?, Never>?

    private init() {
        loadTokens()
    }

    /// Restores the saved login. Safe to call again once the watch is unlocked.
    func loadTokens() {
        guard !isAuthenticated, case .found(let token) = accessKeychain.read() else { return }
        accessKeychain.relaxAccessibility()
        refreshKeychain.relaxAccessibility()
        accessToken = token
        accountID = tokenPayload(token)?["sub"] as? String
        isAuthenticated = true
    }

    func setTokens(access: String, refresh: String) {
        revision += 1
        accessKeychain.save(access)
        refreshKeychain.save(refresh)
        accessToken = access
        accountID = tokenPayload(access)?["sub"] as? String
        isAuthenticated = true
    }

    func clearTokens() {
        revision += 1
        accessKeychain.delete()
        refreshKeychain.delete()
        accessToken = nil
        accountID = nil
        isAuthenticated = false
    }

    /// Applies a login change sent by the iPhone, unless the watch already has a newer one.
    func applyPhoneChange(_ payload: [String: Any]) {
        let changedAt = payload["auth_updated_at"] as? Double ?? 0
        // The latest application context is replayed on every launch; apply it only once.
        guard changedAt > UserDefaults.standard.double(forKey: lastChangeKey) else { return }
        if payload["clear_tokens"] as? Bool == true {
            UserDefaults.standard.set(changedAt, forKey: lastChangeKey)
            clearTokens()
        } else if let access = payload["access_token"] as? String,
                  let refresh = payload["refresh_token"] as? String {
            UserDefaults.standard.set(changedAt, forKey: lastChangeKey)
            setTokens(access: access, refresh: refresh)
        }
    }

    func getValidToken() async -> String? {
        loadTokens()
        guard let token = accessToken else { return nil }
        if isTokenExpired(token) {
            return await refreshTokens()
        }
        return token
    }

    /// The server rejected `token`; returns a newer one if the login is still valid.
    func tokenAfterRejection(of token: String) async -> String? {
        if let current = accessToken, current != token, !isTokenExpired(current) {
            return current
        }
        return await refreshTokens()
    }

    /// Concurrent callers share one refresh, so they never race each other's token rotation.
    private func refreshTokens() async -> String? {
        if let refreshTask { return await refreshTask.value }
        let task = Task { () -> String? in
            defer { refreshTask = nil }
            return await performRefresh()
        }
        refreshTask = task
        return await task.value
    }

    private func performRefresh() async -> String? {
        let requestRevision = revision
        let refreshToken: String
        switch refreshKeychain.read() {
        case .found(let token): refreshToken = token
        case .missing:
            clearTokens()
            return nil
        case .unavailable:
            return nil
        }

        guard let url = URL(string: "\(backendUrl)/auth/watch-refresh") else {
            return nil
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(["refreshToken": refreshToken])

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard requestRevision == revision else { return accessToken }
            guard let httpResponse = response as? HTTPURLResponse else { return nil }
            guard httpResponse.statusCode == 200 else {
                // Only the refresh endpoint can say the login itself is no longer valid.
                if httpResponse.statusCode == 401 { clearTokens() }
                return nil
            }
            let tokenResponse = try JSONDecoder().decode(WatchTokenResponse.self, from: data)
            setTokens(access: tokenResponse.accessToken, refresh: tokenResponse.refreshToken)
            return tokenResponse.accessToken
        } catch {
            // A network outage does not revoke the saved login.
            return nil
        }
    }

    func handleAppleSignIn(identityToken: String) async -> Bool {
        guard let url = URL(string: "\(backendUrl)/auth/ios-apple-signin") else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = ["identityToken": identityToken, "client": "watch"]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else { return false }

            let tokenResponse = try JSONDecoder().decode(WatchTokenResponse.self, from: data)
            // An older change from the iPhone must not undo this sign-in.
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: lastChangeKey)
            setTokens(access: tokenResponse.accessToken, refresh: tokenResponse.refreshToken)
            return true
        } catch {
            return false
        }
    }

    private func isTokenExpired(_ token: String) -> Bool {
        guard let exp = tokenPayload(token)?["exp"] as? TimeInterval else { return true }
        return Date(timeIntervalSince1970: exp).timeIntervalSinceNow < 60
    }

    private func tokenPayload(_ token: String) -> [String: Any]? {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }

        var base64 = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 { base64.append("=") }

        guard let data = Data(base64Encoded: base64) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}
