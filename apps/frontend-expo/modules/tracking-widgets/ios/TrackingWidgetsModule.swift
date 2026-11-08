import ExpoModulesCore
import WidgetKit

public class TrackingWidgetsModule: Module {
    private let defaults = UserDefaults(suiteName: "group.so.tracking.app")!
    public func definition() -> ModuleDefinition {
        Name("TrackingWidgets")
        AsyncFunction("setAccount") { (account: String?) in
            if account == nil || self.defaults.string(forKey: "widgets.account") != account {
                self.defaults.removeObject(forKey: "widgets.snapshot")
                self.defaults.set(account, forKey: "widgets.account")
                self.defaults.synchronize()
                WidgetCenter.shared.reloadAllTimelines()
            }
        }.runOnQueue(.main)
        AsyncFunction("setSnapshot") { (account: String, snapshot: String) in
            guard self.defaults.string(forKey: "widgets.account") == account,
                  let data = snapshot.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  json["version"] as? Int == 1 else { return }
            guard self.defaults.string(forKey: "widgets.snapshot") != snapshot else { return }
            self.defaults.set(snapshot, forKey: "widgets.snapshot")
            self.defaults.synchronize()
            WidgetCenter.shared.reloadAllTimelines()
        }.runOnQueue(.main)
    }
}
