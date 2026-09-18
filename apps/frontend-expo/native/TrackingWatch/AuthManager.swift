import Foundation
import Security

@MainActor
class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var accessToken: String?
    @Published private(set) var accountID: String?

    private let keychainServiceAccess = "so.tracking.app.watch.access"
    private let keychainServiceRefresh = "so.tracking.app.watch.refresh"
    private let backendUrl = "https://api.tracking.so"
    private var revision = 0

    private init() {
        loadTokens()
    }

    func loadTokens() {
        if let token = readKeychain(service: keychainServiceAccess) {
            accessToken = token
            accountID = tokenPayload(token)?["sub"] as? String
            isAuthenticated = true
        }
    }

    func setTokens(access: String, refresh: String) {
        revision += 1
        saveKeychain(service: keychainServiceAccess, value: access)
        saveKeychain(service: keychainServiceRefresh, value: refresh)
        accessToken = access
        accountID = tokenPayload(access)?["sub"] as? String
        isAuthenticated = true
    }

    func clearTokens() {
        revision += 1
        deleteKeychain(service: keychainServiceAccess)
        deleteKeychain(service: keychainServiceRefresh)
        accessToken = nil
        accountID = nil
        isAuthenticated = false
    }

    func getValidToken() async -> String? {
        guard let token = accessToken else { return nil }
        if isTokenExpired(token) {
            return await refreshTokenIfNeeded()
        }
        return token
    }

    @discardableResult
    func refreshTokenIfNeeded() async -> String? {
        let requestRevision = revision
        guard let refreshToken = readKeychain(service: keychainServiceRefresh) else {
            clearTokens()
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
            guard requestRevision == revision else { return nil }
            guard let httpResponse = response as? HTTPURLResponse else { return nil }
            guard httpResponse.statusCode == 200 else {
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

    // MARK: - Keychain Helpers

    private func saveKeychain(service: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        deleteKeychain(service: service)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "token",
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    private func readKeychain(service: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "token",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func deleteKeychain(service: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "token",
        ]
        SecItemDelete(query as CFDictionary)
    }
}
