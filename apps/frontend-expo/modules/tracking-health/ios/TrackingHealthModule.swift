import ExpoModulesCore
import CryptoKit

public class TrackingHealthModule: Module {
    private var reader: HealthKitReader?

    public func definition() -> ModuleDefinition {
        Name("TrackingHealth")
        AsyncFunction("setAccount") { (account: String?) in
            self.reader?.stopWorkoutObservation()
            guard let account else { self.reader = nil; return }
            let key = SHA256.hash(data: Data(account.utf8)).map { String(format: "%02x", $0) }.joined()
            guard let defaults = UserDefaults(suiteName: "tracking.health.\(key)") else {
                throw HealthKitReaderError.invalidPayload
            }
            self.reader = HealthKitReader(defaults: defaults)
        }.runOnQueue(.main)
        AsyncFunction("isAvailable") { () -> [String: Bool] in
            ["available": HealthKitReader().isAvailable]
        }
        AsyncFunction("requestAuthorization") { (promise: Promise) in
            guard let reader = self.reader else { promise.reject("NO_ACCOUNT", "Sign in before connecting Apple Health"); return }
            reader.requestAuthorization { result in
                switch result {
                case .success: promise.resolve(["requestCompleted": true])
                case .failure(let error): promise.reject("HEALTH_AUTH", error.localizedDescription)
                }
            }
        }.runOnQueue(.main)
        AsyncFunction("setWorkoutDetectionEnabled") { (enabled: Bool, promise: Promise) in
            guard let reader = self.reader else { promise.reject("NO_ACCOUNT", "Sign in before configuring Apple Health"); return }
            reader.setWorkoutDetectionEnabled(enabled) { result in
                switch result {
                case .success: promise.resolve(nil)
                case .failure(let error): promise.reject("HEALTH_BACKGROUND", error.localizedDescription)
                }
            }
        }.runOnQueue(.main)
        AsyncFunction("prepareSync") { (options: [String: Int], promise: Promise) in
            guard let reader = self.reader else { promise.reject("NO_ACCOUNT", "Sign in before syncing Apple Health"); return }
            reader.prepareSync(
                initialLookbackDays: min(90, max(1, options["initialLookbackDays"] ?? 30)),
                refreshLookbackDays: 14,
                estimatedMaxHeartRateBpm: options["estimatedMaxHeartRateBpm"]
            ) { result in
                do {
                    switch result {
                    case .success(let payload): promise.resolve(try payload.bridgeDictionary())
                    case .failure(let error): promise.reject("HEALTH_SYNC", error.localizedDescription)
                    }
                } catch { promise.reject("HEALTH_PAYLOAD", error.localizedDescription) }
            }
        }.runOnQueue(.main)
        AsyncFunction("commitSync") { (options: [String: String]) in
            guard let reader = self.reader, let token = options["syncToken"] else { throw HealthKitReaderError.unknownSyncToken }
            try reader.commitSync(token: token)
        }.runOnQueue(.main)
        AsyncFunction("resetSync") { self.reader?.resetSync() }.runOnQueue(.main)
    }
}
