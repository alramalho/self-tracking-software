import Capacitor

@objc(WatchAuthPlugin)
public class WatchAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WatchAuthPlugin"
    public let jsName = "WatchAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sendTokens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearTokens", returnType: CAPPluginReturnPromise),
    ]

    @objc func sendTokens(_ call: CAPPluginCall) {
        guard let accessToken = call.getString("accessToken"),
              let refreshToken = call.getString("refreshToken") else {
            call.reject("Missing accessToken or refreshToken")
            return
        }

        WatchSessionManager.shared.sendAuthTokens(accessToken: accessToken, refreshToken: refreshToken)
        call.resolve()
    }

    @objc func clearTokens(_ call: CAPPluginCall) {
        WatchSessionManager.shared.clearAuthTokens()
        call.resolve()
    }
}
