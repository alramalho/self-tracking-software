import Foundation
import Security

@MainActor
class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var accessToken: String?

    private let keychainServiceAccess = "so.tracking.app.watch.access"
    private let keychainServiceRefresh = "so.tracking.app.watch.refresh"
    private let supabaseUrl = "https://ujclnxeqzouaxbwkbdbk.supabase.co"
    private let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqY2xueGVxem91YXhid2tiZGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTAyMzEsImV4cCI6MjA3MTI2NjIzMX0.sm9eDAtSLD644G0ZYAtbydqxUB7lHbAQbeuYN9wrTvc"

    private init() {
        loadTokens()
    }

    func loadTokens() {
        if let token = readKeychain(service: keychainServiceAccess) {
            if isTokenExpired(token) {
                Task { await refreshTokenIfNeeded() }
            } else {
                accessToken = token
                isAuthenticated = true
            }
        }
    }

    func setTokens(access: String, refresh: String) {
        saveKeychain(service: keychainServiceAccess, value: access)
        saveKeychain(service: keychainServiceRefresh, value: refresh)
        accessToken = access
        isAuthenticated = true
    }

    func clearTokens() {
        deleteKeychain(service: keychainServiceAccess)
        deleteKeychain(service: keychainServiceRefresh)
        accessToken = nil
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
        guard let refreshToken = readKeychain(service: keychainServiceRefresh) else {
            clearTokens()
            return nil
        }

        guard let url = URL(string: "\(supabaseUrl)/auth/v1/token?grant_type=refresh_token") else {
            return nil
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.httpBody = try? JSONEncoder().encode(["refresh_token": refreshToken])

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                clearTokens()
                return nil
            }
            let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
            setTokens(access: tokenResponse.access_token, refresh: tokenResponse.refresh_token)
            return tokenResponse.access_token
        } catch {
            clearTokens()
            return nil
        }
    }

    func handleAppleSignIn(identityToken: String) async -> Bool {
        let backendUrl = "https://api.tracking.so"
        guard let url = URL(string: "\(backendUrl)/auth/ios-apple-signin") else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = ["identityToken": identityToken]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else { return false }

            let signInResponse = try JSONDecoder().decode(AppleSignInResponse.self, from: data)

            guard let verifyUrl = URL(string: signInResponse.verificationUrl),
                  let components = URLComponents(url: verifyUrl, resolvingAgainstBaseURL: false),
                  let tokenHash = components.queryItems?.first(where: { $0.name == "token" })?.value else {
                return false
            }

            return await verifyMagicLink(tokenHash: tokenHash)
        } catch {
            return false
        }
    }

    private func verifyMagicLink(tokenHash: String) async -> Bool {
        guard let url = URL(string: "\(supabaseUrl)/auth/v1/verify?type=magiclink&token=\(tokenHash)") else {
            return false
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else { return false }

            let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
            setTokens(access: tokenResponse.access_token, refresh: tokenResponse.refresh_token)
            return true
        } catch {
            return false
        }
    }

    private func isTokenExpired(_ token: String) -> Bool {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return true }

        var base64 = String(parts[1])
        while base64.count % 4 != 0 { base64.append("=") }

        guard let data = Data(base64Encoded: base64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = json["exp"] as? TimeInterval else {
            return true
        }

        return Date(timeIntervalSince1970: exp).timeIntervalSinceNow < 60
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
