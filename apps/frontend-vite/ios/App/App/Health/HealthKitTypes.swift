import Foundation
import HealthKit

struct HealthDailyMetricPayload: Encodable {
    let localDate: String
    let metric: String
    let aggregation: String
    let value: Double
    let unit: String
    let sourceBundleId: String?
    let sourceName: String?
    let timezone: String?
    let sampleCount: Int?
}

struct HealthWorkoutPayload: Encodable {
    let externalId: String
    let activityTypeCode: Int
    let activityTypeName: String
    let startAt: String
    let endAt: String
    let durationSeconds: Double
    let activeEnergyKcal: Double?
    let distanceMeters: Double?
    let sourceBundleId: String
    let sourceName: String?
    let sourceProductType: String?
    let deviceName: String?
    let deviceModel: String?
    let timezone: String?
}

struct HealthSleepSamplePayload: Encodable {
    let externalId: String
    let stageCode: Int
    let stage: String
    let startAt: String
    let endAt: String
    let sourceBundleId: String
    let sourceName: String?
    let sourceProductType: String?
    let deviceName: String?
    let deviceModel: String?
    let timezone: String?
}

struct PreparedHealthSyncPayload: Encodable {
    let syncToken: String
    let deviceId: String
    let requestedDataTypes: [String]
    let initialSyncStartAt: String
    let syncStartedAt: String
    let dailyMetrics: [HealthDailyMetricPayload]
    let workouts: [HealthWorkoutPayload]
    let sleepSamples: [HealthSleepSamplePayload]
    let deletedWorkoutIds: [String]
    let deletedSleepSampleIds: [String]

    func capacitorDictionary() throws -> [String: Any] {
        let encoded = try JSONEncoder.healthKit.encode(self)
        guard let dictionary = try JSONSerialization.jsonObject(with: encoded) as? [String: Any] else {
            throw HealthKitReaderError.invalidPayload
        }
        return dictionary
    }
}

struct PendingHealthKitAnchors {
    let workout: HKQueryAnchor
    let sleep: HKQueryAnchor
    let initialSyncStartAt: Date
}

struct AnchoredHealthKitResult {
    let added: [HKSample]
    let deletedExternalIds: [String]
    let anchor: HKQueryAnchor
}

enum HealthKitReaderError: LocalizedError {
    case unavailable
    case missingHealthType(String)
    case queryReturnedNoAnchor
    case invalidPayload
    case unknownSyncToken

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "Apple Health is not available on this device."
        case let .missingHealthType(identifier):
            return "Apple Health data type is unavailable: \(identifier)."
        case .queryReturnedNoAnchor:
            return "Apple Health did not return a sync anchor."
        case .invalidPayload:
            return "Could not encode the Apple Health sync payload."
        case .unknownSyncToken:
            return "The prepared Apple Health sync is no longer available."
        }
    }
}

extension JSONEncoder {
    static let healthKit: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return encoder
    }()
}

extension ISO8601DateFormatter {
    static let healthKit: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
