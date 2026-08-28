import Capacitor
import Foundation

@objc(AppleHealthPlugin)
public class AppleHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleHealthPlugin"
    public let jsName = "AppleHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareSync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "commitSync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetSync", returnType: CAPPluginReturnPromise),
    ]

    private let reader = HealthKitReader()

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": reader.isAvailable])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.reader.requestAuthorization { result in
                switch result {
                case .success:
                    call.resolve(["requestCompleted": true])
                case let .failure(error):
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    @objc func prepareSync(_ call: CAPPluginCall) {
        let initialLookbackDays = call.getInt("initialLookbackDays") ?? 180
        let refreshLookbackDays = call.getInt("refreshLookbackDays") ?? 14

        reader.prepareSync(
            initialLookbackDays: initialLookbackDays,
            refreshLookbackDays: refreshLookbackDays
        ) { result in
            do {
                switch result {
                case let .success(payload):
                    call.resolve(try payload.capacitorDictionary())
                case let .failure(error):
                    call.reject(error.localizedDescription)
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func commitSync(_ call: CAPPluginCall) {
        guard let syncToken = call.getString("syncToken") else {
            call.reject("Missing syncToken")
            return
        }

        do {
            try reader.commitSync(token: syncToken)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func resetSync(_ call: CAPPluginCall) {
        reader.resetSync()
        call.resolve()
    }
}
