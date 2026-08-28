import Capacitor

@objc(TrackingBridgeViewController)
final class TrackingBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(WatchAuthPlugin())
        bridge?.registerPluginInstance(AppleHealthPlugin())
    }
}
