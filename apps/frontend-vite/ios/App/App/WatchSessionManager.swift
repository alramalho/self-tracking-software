import Foundation
import WatchConnectivity

class WatchSessionManager: NSObject, WCSessionDelegate {
    static let shared = WatchSessionManager()

    private var latestAuthPayload: [String: Any]?

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
        DispatchQueue.main.async {
            self.latestAuthPayload = [
                "access_token": accessToken,
                "refresh_token": refreshToken,
            ]
            self.deliverLatestAuthPayload()
        }
    }

    func clearAuthTokens() {
        guard WCSession.isSupported() else { return }
        DispatchQueue.main.async {
            self.latestAuthPayload = ["clear_tokens": true]
            self.deliverLatestAuthPayload()
        }
    }

    private func deliverLatestAuthPayload() {
        guard let payload = latestAuthPayload else { return }

        let session = WCSession.default
        guard session.activationState == .activated else { return }

        #if os(iOS)
        guard session.isPaired, session.isWatchAppInstalled else { return }
        #endif

        do {
            try session.updateApplicationContext(payload)
        } catch {
            print("[iPhone] Failed to update Watch auth context: \(error.localizedDescription)")
        }

        session.transferUserInfo(payload)

        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { error in
                print("[iPhone] Failed to send immediate Watch auth message: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            print("[iPhone] WCSession activation failed: \(error.localizedDescription)")
            return
        }

        DispatchQueue.main.async { self.deliverLatestAuthPayload() }
    }

    #if os(iOS)
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }

    func sessionWatchStateDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.deliverLatestAuthPayload() }
    }
    #endif

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard message["request_auth"] as? Bool == true else { return }
        DispatchQueue.main.async { self.deliverLatestAuthPayload() }
    }
}
