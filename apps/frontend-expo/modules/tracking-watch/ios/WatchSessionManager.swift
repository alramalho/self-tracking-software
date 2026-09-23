import Foundation
import Security
import WatchConnectivity

final class WatchSessionManager: NSObject, WCSessionDelegate {
    static let shared = WatchSessionManager()
    private var account: String?
    private var payload: [String: Any]?
    private let keychainService = "so.tracking.app.expo.watch-auth"

    private override init() {
        super.init()
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService, kSecAttrAccount as String: "payload",
            kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: AnyObject?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data,
           let saved = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            payload = saved
            account = saved["account"] as? String
        }
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    func setAccount(_ next: String?) {
        if account != next || next == nil {
            account = next
            save(["clear_tokens": true])
        }
        deliver()
    }

    func sendTokens(account: String, access: String, refresh: String) {
        // Discard API responses from a previous account or a completed logout.
        guard self.account == account else { return }
        save(["account": account, "access_token": access, "refresh_token": refresh])
        deliver()
    }

    private func save(_ value: [String: Any]) {
        // A timestamp lets the watch reject a late delivery of older credentials.
        var current = value
        current["auth_updated_at"] = Date().timeIntervalSince1970
        payload = current
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService, kSecAttrAccount as String: "payload"]
        SecItemDelete(query as CFDictionary)
        guard let data = try? JSONSerialization.data(withJSONObject: current) else { return }
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }

    private func deliver() {
        guard WCSession.isSupported(), let payload else { return }
        let session = WCSession.default
        guard session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else { return }
        // Application context retains only the latest state while the watch is offline.
        try? session.updateApplicationContext(payload)
        if session.isReachable { session.sendMessage(payload, replyHandler: nil, errorHandler: { _ in }) }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async { self.deliver() }
    }
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { session.activate() }
    func sessionWatchStateDidChange(_ session: WCSession) { DispatchQueue.main.async { self.deliver() } }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if message["request_auth"] as? Bool == true { DispatchQueue.main.async { self.deliver() } }
    }
}
