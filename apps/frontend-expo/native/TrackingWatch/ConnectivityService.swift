import Foundation
import WatchConnectivity

class ConnectivityService: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = ConnectivityService()

    override private init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            print("[Watch] WCSession activation failed: \(error.localizedDescription)")
            return
        }

        handleAuthPayload(session.receivedApplicationContext)
        requestLatestAuth(from: session)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        handleAuthPayload(userInfo)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handleAuthPayload(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleAuthPayload(message)
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        requestLatestAuth(from: session)
    }

    private func requestLatestAuth(from session: WCSession) {
        guard session.activationState == .activated, session.isReachable else { return }
        session.sendMessage(["request_auth": true], replyHandler: nil) { error in
            print("[Watch] Failed to request auth from iPhone: \(error.localizedDescription)")
        }
    }

    private func handleAuthPayload(_ payload: [String: Any]) {
        Task { @MainActor in
            let timestamp = payload["auth_updated_at"] as? Double ?? 0
            let last = UserDefaults.standard.double(forKey: "lastPhoneAuthUpdate")
            guard timestamp >= last else { return }
            if payload["clear_tokens"] as? Bool == true {
                UserDefaults.standard.set(timestamp, forKey: "lastPhoneAuthUpdate")
                AuthManager.shared.clearTokens()
            } else if let access = payload["access_token"] as? String,
                      let refresh = payload["refresh_token"] as? String {
                UserDefaults.standard.set(timestamp, forKey: "lastPhoneAuthUpdate")
                AuthManager.shared.setTokens(access: access, refresh: refresh)
            }
        }
    }
}
