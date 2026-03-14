import Foundation
import WatchConnectivity

class WatchSessionManager: NSObject, WCSessionDelegate {
    static let shared = WatchSessionManager()

    private override init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func sendAuthTokens(accessToken: String, refreshToken: String) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default

        guard session.activationState == .activated else { return }

        #if os(iOS)
        guard session.isPaired, session.isWatchAppInstalled else { return }
        #endif

        let userInfo: [String: Any] = [
            "access_token": accessToken,
            "refresh_token": refreshToken,
        ]

        session.transferUserInfo(userInfo)
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            print("[iPhone] WCSession activation failed: \(error.localizedDescription)")
        }
    }

    #if os(iOS)
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }
    #endif
}
