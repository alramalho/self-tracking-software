import ExpoModulesCore

public class TrackingMapModule: Module {
    public func definition() -> ModuleDefinition {
        Name("TrackingMap")

        View(TrackingMapView.self) {
            Prop("dark") { (view: TrackingMapView, dark: Bool) in
                view.setDarkMode(dark)
            }
            Prop("routeJSON") { (view: TrackingMapView, routeJSON: String?) in
                view.setRoute(routeJSON)
            }
        }
    }
}
