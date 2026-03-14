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
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard let accessToken = userInfo["access_token"] as? String,
              let refreshToken = userInfo["refresh_token"] as? String else { return }

        Task { @MainActor in
            AuthManager.shared.setTokens(access: accessToken, refresh: refreshToken)
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let accessToken = message["access_token"] as? String,
              let refreshToken = message["refresh_token"] as? String else { return }

        Task { @MainActor in
            AuthManager.shared.setTokens(access: accessToken, refresh: refreshToken)
        }
    }
}
