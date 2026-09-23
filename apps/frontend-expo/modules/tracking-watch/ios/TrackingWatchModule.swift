import ExpoModulesCore

public class TrackingWatchModule: Module {
    public func definition() -> ModuleDefinition {
        Name("TrackingWatch")
        AsyncFunction("setAccount") { (account: String?) in
            WatchSessionManager.shared.setAccount(account)
        }.runOnQueue(.main)
        AsyncFunction("sendTokens") { (account: String, access: String, refresh: String) in
            WatchSessionManager.shared.sendTokens(account: account, access: access, refresh: refresh)
        }.runOnQueue(.main)
    }
}
