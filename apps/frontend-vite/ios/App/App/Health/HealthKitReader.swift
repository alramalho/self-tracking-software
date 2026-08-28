import Foundation
import HealthKit

final class HealthKitReader {
    private enum DefaultsKey {
        static let deviceId = "appleHealth.deviceId"
        static let workoutAnchor = "appleHealth.workoutAnchor"
        static let sleepAnchor = "appleHealth.sleepAnchor"
        static let initialSyncStartAt = "appleHealth.initialSyncStartAt"
        static let completedInitialSync = "appleHealth.completedInitialSync"
    }

    private enum QuantityAggregation {
        case sum
        case average
        case mostRecent

        var payloadName: String {
            switch self {
            case .sum:
                return "sum"
            case .average:
                return "average"
            case .mostRecent:
                return "most_recent"
            }
        }

        var statisticsOptions: HKStatisticsOptions {
            switch self {
            case .sum:
                return .cumulativeSum
            case .average:
                return .discreteAverage
            case .mostRecent:
                return .mostRecent
            }
        }
    }

    private struct QuantityDefinition {
        let identifier: HKQuantityTypeIdentifier
        let metric: String
        let aggregation: QuantityAggregation
        let unit: HKUnit
        let payloadUnit: String
        let multiplier: Double
    }

    private struct SleepMetricKey: Hashable {
        let localDate: String
        let metric: String
        let sourceBundleId: String
    }

    private struct SleepMetricAccumulator {
        var minutes: Double = 0
        var sampleCount: Int = 0
        var sourceName: String?
        var timezone: String = TimeZone.current.identifier
    }

    private let healthStore = HKHealthStore()
    private let defaults: UserDefaults
    private let pendingLock = NSLock()
    private var pendingAnchors: [String: PendingHealthKitAnchors] = [:]

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    var requestedDataTypeNames: [String] {
        quantityDefinitions.map(\.metric) + ["workout", "sleep_analysis"]
    }

    func requestAuthorization(completion: @escaping (Result<Void, Error>) -> Void) {
        guard isAvailable else {
            completion(.failure(HealthKitReaderError.unavailable))
            return
        }

        do {
            let types = try requestedReadTypes()
            healthStore.requestAuthorization(toShare: [], read: types) { _, error in
                if let error {
                    completion(.failure(error))
                    return
                }
                // HealthKit deliberately does not reveal individual read
                // denials. A completed sheet means only that the request ran.
                completion(.success(()))
            }
        } catch {
            completion(.failure(error))
        }
    }

    func prepareSync(
        initialLookbackDays: Int,
        refreshLookbackDays: Int,
        completion: @escaping (Result<PreparedHealthSyncPayload, Error>) -> Void
    ) {
        guard isAvailable else {
            completion(.failure(HealthKitReaderError.unavailable))
            return
        }

        let now = Date()
        let completedInitialSync = defaults.bool(forKey: DefaultsKey.completedInitialSync)
        let lookbackDays = completedInitialSync ? refreshLookbackDays : initialLookbackDays
        let startAt = Calendar.current.date(
            byAdding: .day,
            value: -max(1, lookbackDays),
            to: now
        ) ?? now.addingTimeInterval(-Double(max(1, lookbackDays)) * 86_400)
        let initialSyncStartAt = defaults.object(forKey: DefaultsKey.initialSyncStartAt) as? Date ?? startAt
        let syncToken = UUID().uuidString

        do {
            let workoutType = HKObjectType.workoutType()
            guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
                throw HealthKitReaderError.missingHealthType("sleep_analysis")
            }

            let group = DispatchGroup()
            let resultLock = NSLock()
            var firstError: Error?
            var workoutResult: AnchoredHealthKitResult?
            var sleepResult: AnchoredHealthKitResult?
            var dailyMetrics: [HealthDailyMetricPayload] = []
            var sleepSnapshot: [HKCategorySample] = []

            group.enter()
            queryAnchoredSamples(
                type: workoutType,
                anchor: loadAnchor(forKey: DefaultsKey.workoutAnchor),
                initialStartAt: startAt
            ) { result in
                resultLock.lock()
                switch result {
                case let .success(value):
                    workoutResult = value
                case let .failure(error):
                    firstError = firstError ?? error
                }
                resultLock.unlock()
                group.leave()
            }

            group.enter()
            queryAnchoredSamples(
                type: sleepType,
                anchor: loadAnchor(forKey: DefaultsKey.sleepAnchor),
                initialStartAt: startAt
            ) { result in
                resultLock.lock()
                switch result {
                case let .success(value):
                    sleepResult = value
                case let .failure(error):
                    firstError = firstError ?? error
                }
                resultLock.unlock()
                group.leave()
            }

            group.enter()
            queryDailyQuantityMetrics(startAt: startAt, endAt: now) { result in
                resultLock.lock()
                switch result {
                case let .success(values):
                    dailyMetrics = values
                case let .failure(error):
                    firstError = firstError ?? error
                }
                resultLock.unlock()
                group.leave()
            }

            group.enter()
            querySleepSnapshot(startAt: startAt, endAt: now) { result in
                resultLock.lock()
                switch result {
                case let .success(samples):
                    sleepSnapshot = samples
                case let .failure(error):
                    firstError = firstError ?? error
                }
                resultLock.unlock()
                group.leave()
            }

            group.notify(queue: .global(qos: .userInitiated)) { [weak self] in
                guard let self else { return }
                if let firstError {
                    completion(.failure(firstError))
                    return
                }
                guard let workoutResult, let sleepResult else {
                    completion(.failure(HealthKitReaderError.queryReturnedNoAnchor))
                    return
                }

                let sleepDailyMetrics = self.makeSleepDailyMetrics(from: sleepSnapshot)
                let payload = PreparedHealthSyncPayload(
                    syncToken: syncToken,
                    deviceId: self.deviceId,
                    requestedDataTypes: self.requestedDataTypeNames,
                    initialSyncStartAt: ISO8601DateFormatter.healthKit.string(from: initialSyncStartAt),
                    syncStartedAt: ISO8601DateFormatter.healthKit.string(from: now),
                    dailyMetrics: (dailyMetrics + sleepDailyMetrics).sorted {
                        ($0.localDate, $0.metric, $0.sourceBundleId ?? "") <
                            ($1.localDate, $1.metric, $1.sourceBundleId ?? "")
                    },
                    workouts: workoutResult.added.compactMap {
                        ($0 as? HKWorkout).map(self.makeWorkoutPayload)
                    },
                    sleepSamples: sleepResult.added.compactMap {
                        ($0 as? HKCategorySample).flatMap(self.makeSleepSamplePayload)
                    },
                    deletedWorkoutIds: workoutResult.deletedExternalIds,
                    deletedSleepSampleIds: sleepResult.deletedExternalIds
                )

                self.pendingLock.lock()
                self.pendingAnchors[syncToken] = PendingHealthKitAnchors(
                    workout: workoutResult.anchor,
                    sleep: sleepResult.anchor,
                    initialSyncStartAt: initialSyncStartAt
                )
                self.pendingLock.unlock()

                completion(.success(payload))
            }
        } catch {
            completion(.failure(error))
        }
    }

    func commitSync(token: String) throws {
        pendingLock.lock()
        let pending = pendingAnchors.removeValue(forKey: token)
        pendingLock.unlock()

        guard let pending else {
            throw HealthKitReaderError.unknownSyncToken
        }

        try saveAnchor(pending.workout, forKey: DefaultsKey.workoutAnchor)
        try saveAnchor(pending.sleep, forKey: DefaultsKey.sleepAnchor)
        defaults.set(pending.initialSyncStartAt, forKey: DefaultsKey.initialSyncStartAt)
        defaults.set(true, forKey: DefaultsKey.completedInitialSync)
    }

    func resetSync() {
        pendingLock.lock()
        pendingAnchors.removeAll()
        pendingLock.unlock()

        [
            DefaultsKey.workoutAnchor,
            DefaultsKey.sleepAnchor,
            DefaultsKey.initialSyncStartAt,
            DefaultsKey.completedInitialSync,
        ].forEach(defaults.removeObject)
    }

    private var deviceId: String {
        if let existing = defaults.string(forKey: DefaultsKey.deviceId) {
            return existing
        }

        let created = UUID().uuidString
        defaults.set(created, forKey: DefaultsKey.deviceId)
        return created
    }

    private var quantityDefinitions: [QuantityDefinition] {
        [
            QuantityDefinition(
                identifier: .stepCount,
                metric: "step_count",
                aggregation: .sum,
                unit: .count(),
                payloadUnit: "count",
                multiplier: 1
            ),
            QuantityDefinition(
                identifier: .activeEnergyBurned,
                metric: "active_energy_burned",
                aggregation: .sum,
                unit: .largeCalorie(),
                payloadUnit: "kcal",
                multiplier: 1
            ),
            QuantityDefinition(
                identifier: .appleExerciseTime,
                metric: "apple_exercise_time",
                aggregation: .sum,
                unit: .minute(),
                payloadUnit: "min",
                multiplier: 1
            ),
            QuantityDefinition(
                identifier: .distanceWalkingRunning,
                metric: "walking_running_distance",
                aggregation: .sum,
                unit: .meter(),
                payloadUnit: "m",
                multiplier: 1
            ),
            QuantityDefinition(
                identifier: .flightsClimbed,
                metric: "flights_climbed",
                aggregation: .sum,
                unit: .count(),
                payloadUnit: "count",
                multiplier: 1
            ),
            QuantityDefinition(
                identifier: .restingHeartRate,
                metric: "resting_heart_rate",
                aggregation: .average,
                unit: HKUnit.count().unitDivided(by: .minute()),
                payloadUnit: "count/min",
                multiplier: 1
            ),
            QuantityDefinition(
                identifier: .heartRateVariabilitySDNN,
                metric: "heart_rate_variability_sdnn",
                aggregation: .average,
                unit: .secondUnit(with: .milli),
                payloadUnit: "ms",
                multiplier: 1
            ),
            QuantityDefinition(
                identifier: .respiratoryRate,
                metric: "respiratory_rate",
                aggregation: .average,
                unit: HKUnit.count().unitDivided(by: .minute()),
                payloadUnit: "count/min",
                multiplier: 1
            ),
            QuantityDefinition(
                identifier: .oxygenSaturation,
                metric: "oxygen_saturation",
                aggregation: .average,
                unit: .percent(),
                payloadUnit: "%",
                multiplier: 100
            ),
            QuantityDefinition(
                identifier: .bodyMass,
                metric: "body_mass",
                aggregation: .mostRecent,
                unit: .gramUnit(with: .kilo),
                payloadUnit: "kg",
                multiplier: 1
            ),
        ]
    }

    private func requestedReadTypes() throws -> Set<HKObjectType> {
        var types: Set<HKObjectType> = [
            HKObjectType.workoutType(),
        ]

        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            throw HealthKitReaderError.missingHealthType("sleep_analysis")
        }
        types.insert(sleepType)

        for definition in quantityDefinitions {
            guard let type = HKObjectType.quantityType(forIdentifier: definition.identifier) else {
                throw HealthKitReaderError.missingHealthType(definition.metric)
            }
            types.insert(type)
        }
        return types
    }

    private func queryAnchoredSamples(
        type: HKSampleType,
        anchor: HKQueryAnchor?,
        initialStartAt: Date,
        completion: @escaping (Result<AnchoredHealthKitResult, Error>) -> Void
    ) {
        let predicate = anchor == nil
            ? HKQuery.predicateForSamples(
                withStart: initialStartAt,
                end: nil,
                options: [.strictStartDate]
            )
            : nil
        let query = HKAnchoredObjectQuery(
            type: type,
            predicate: predicate,
            anchor: anchor,
            limit: HKObjectQueryNoLimit
        ) { _, samples, deletedObjects, newAnchor, error in
            if let error {
                completion(.failure(error))
                return
            }
            guard let newAnchor else {
                completion(.failure(HealthKitReaderError.queryReturnedNoAnchor))
                return
            }

            completion(
                .success(
                    AnchoredHealthKitResult(
                        added: samples ?? [],
                        deletedExternalIds: (deletedObjects ?? []).map {
                            $0.uuid.uuidString
                        },
                        anchor: newAnchor
                    )
                )
            )
        }
        healthStore.execute(query)
    }

    private func queryDailyQuantityMetrics(
        startAt: Date,
        endAt: Date,
        completion: @escaping (Result<[HealthDailyMetricPayload], Error>) -> Void
    ) {
        let definitions = quantityDefinitions
        let group = DispatchGroup()
        let resultLock = NSLock()
        var values: [HealthDailyMetricPayload] = []
        var firstError: Error?

        for definition in definitions {
            group.enter()
            queryDailyQuantityMetric(
                definition,
                startAt: startAt,
                endAt: endAt
            ) { result in
                resultLock.lock()
                switch result {
                case let .success(metrics):
                    values.append(contentsOf: metrics)
                case let .failure(error):
                    firstError = firstError ?? error
                }
                resultLock.unlock()
                group.leave()
            }
        }

        group.notify(queue: .global(qos: .userInitiated)) {
            if let firstError {
                completion(.failure(firstError))
            } else {
                completion(.success(values))
            }
        }
    }

    private func queryDailyQuantityMetric(
        _ definition: QuantityDefinition,
        startAt: Date,
        endAt: Date,
        completion: @escaping (Result<[HealthDailyMetricPayload], Error>) -> Void
    ) {
        guard let quantityType = HKObjectType.quantityType(forIdentifier: definition.identifier) else {
            completion(.failure(HealthKitReaderError.missingHealthType(definition.metric)))
            return
        }

        let calendar = Calendar.current
        let anchorDate = calendar.startOfDay(for: startAt)
        let predicate = HKQuery.predicateForSamples(
            withStart: anchorDate,
            end: endAt,
            options: [.strictStartDate]
        )
        let query = HKStatisticsCollectionQuery(
            quantityType: quantityType,
            quantitySamplePredicate: predicate,
            options: definition.aggregation.statisticsOptions,
            anchorDate: anchorDate,
            intervalComponents: DateComponents(day: 1)
        )

        query.initialResultsHandler = { _, collection, error in
            if let error {
                completion(.failure(error))
                return
            }

            var metrics: [HealthDailyMetricPayload] = []
            let timezone = TimeZone.current.identifier
            collection?.enumerateStatistics(from: anchorDate, to: endAt) { statistics, _ in
                let quantity: HKQuantity?
                switch definition.aggregation {
                case .sum:
                    quantity = statistics.sumQuantity()
                case .average:
                    quantity = statistics.averageQuantity()
                case .mostRecent:
                    quantity = statistics.mostRecentQuantity()
                }

                guard let quantity else { return }
                let value = quantity.doubleValue(for: definition.unit) * definition.multiplier
                guard value.isFinite else { return }

                metrics.append(
                    HealthDailyMetricPayload(
                        localDate: self.localDateString(
                            from: statistics.startDate,
                            timezone: .current
                        ),
                        metric: definition.metric,
                        aggregation: definition.aggregation.payloadName,
                        value: value,
                        unit: definition.payloadUnit,
                        sourceBundleId: nil,
                        sourceName: nil,
                        timezone: timezone,
                        sampleCount: nil
                    )
                )
            }
            completion(.success(metrics))
        }
        healthStore.execute(query)
    }

    private func querySleepSnapshot(
        startAt: Date,
        endAt: Date,
        completion: @escaping (Result<[HKCategorySample], Error>) -> Void
    ) {
        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            completion(.failure(HealthKitReaderError.missingHealthType("sleep_analysis")))
            return
        }
        let predicate = HKQuery.predicateForSamples(
            withStart: startAt,
            end: endAt,
            options: []
        )
        let query = HKSampleQuery(
            sampleType: sleepType,
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: nil
        ) { _, samples, error in
            if let error {
                completion(.failure(error))
                return
            }
            completion(.success((samples as? [HKCategorySample]) ?? []))
        }
        healthStore.execute(query)
    }

    private func makeSleepDailyMetrics(
        from samples: [HKCategorySample]
    ) -> [HealthDailyMetricPayload] {
        var accumulated: [SleepMetricKey: SleepMetricAccumulator] = [:]

        for sample in samples {
            guard let stage = sleepStage(for: sample.value) else { continue }
            let source = sample.sourceRevision.source
            let timezone = sleepTimezone(for: sample)
            let localDate = localDateString(
                from: sample.endDate,
                timezone: TimeZone(identifier: timezone) ?? .current
            )
            let minutes = sample.endDate.timeIntervalSince(sample.startDate) / 60
            guard minutes > 0, minutes.isFinite else { continue }

            let stageMetric = sleepMetric(for: stage)
            accumulateSleepMetric(
                into: &accumulated,
                localDate: localDate,
                metric: stageMetric,
                minutes: minutes,
                sourceBundleId: source.bundleIdentifier,
                sourceName: source.name,
                timezone: timezone
            )

            if isAsleepStage(stage) {
                accumulateSleepMetric(
                    into: &accumulated,
                    localDate: localDate,
                    metric: "sleep_asleep",
                    minutes: minutes,
                    sourceBundleId: source.bundleIdentifier,
                    sourceName: source.name,
                    timezone: timezone
                )
            }
        }

        return accumulated.map { key, value in
            HealthDailyMetricPayload(
                localDate: key.localDate,
                metric: key.metric,
                aggregation: "duration",
                value: value.minutes,
                unit: "min",
                sourceBundleId: key.sourceBundleId,
                sourceName: value.sourceName,
                timezone: value.timezone,
                sampleCount: value.sampleCount
            )
        }
    }

    private func accumulateSleepMetric(
        into accumulated: inout [SleepMetricKey: SleepMetricAccumulator],
        localDate: String,
        metric: String,
        minutes: Double,
        sourceBundleId: String,
        sourceName: String?,
        timezone: String
    ) {
        let key = SleepMetricKey(
            localDate: localDate,
            metric: metric,
            sourceBundleId: sourceBundleId
        )
        var current = accumulated[key] ?? SleepMetricAccumulator()
        current.minutes += minutes
        current.sampleCount += 1
        current.sourceName = current.sourceName ?? sourceName
        current.timezone = timezone
        accumulated[key] = current
    }

    private func makeWorkoutPayload(_ workout: HKWorkout) -> HealthWorkoutPayload {
        let source = workout.sourceRevision.source
        return HealthWorkoutPayload(
            externalId: workout.uuid.uuidString,
            activityTypeCode: Int(workout.workoutActivityType.rawValue),
            activityTypeName: workoutActivityName(workout.workoutActivityType),
            startAt: ISO8601DateFormatter.healthKit.string(from: workout.startDate),
            endAt: ISO8601DateFormatter.healthKit.string(from: workout.endDate),
            durationSeconds: workout.duration,
            activeEnergyKcal: workout.totalEnergyBurned?.doubleValue(for: .largeCalorie()),
            distanceMeters: workout.totalDistance?.doubleValue(for: .meter()),
            sourceBundleId: source.bundleIdentifier,
            sourceName: source.name,
            sourceProductType: workout.sourceRevision.productType,
            deviceName: workout.device?.name,
            deviceModel: workout.device?.model,
            timezone: metadataTimezone(for: workout)
        )
    }

    private func makeSleepSamplePayload(
        _ sample: HKCategorySample
    ) -> HealthSleepSamplePayload? {
        guard let stage = sleepStage(for: sample.value) else { return nil }
        let source = sample.sourceRevision.source
        return HealthSleepSamplePayload(
            externalId: sample.uuid.uuidString,
            stageCode: sample.value,
            stage: stage,
            startAt: ISO8601DateFormatter.healthKit.string(from: sample.startDate),
            endAt: ISO8601DateFormatter.healthKit.string(from: sample.endDate),
            sourceBundleId: source.bundleIdentifier,
            sourceName: source.name,
            sourceProductType: sample.sourceRevision.productType,
            deviceName: sample.device?.name,
            deviceModel: sample.device?.model,
            timezone: sleepTimezone(for: sample)
        )
    }

    private func sleepStage(for rawValue: Int) -> String? {
        if rawValue == HKCategoryValueSleepAnalysis.inBed.rawValue {
            return "in_bed"
        }
        if rawValue == HKCategoryValueSleepAnalysis.asleep.rawValue {
            return "asleep_unspecified"
        }

        if #available(iOS 16.0, *) {
            switch rawValue {
            case HKCategoryValueSleepAnalysis.awake.rawValue:
                return "awake"
            case HKCategoryValueSleepAnalysis.asleepCore.rawValue:
                return "asleep_core"
            case HKCategoryValueSleepAnalysis.asleepDeep.rawValue:
                return "asleep_deep"
            case HKCategoryValueSleepAnalysis.asleepREM.rawValue:
                return "asleep_rem"
            default:
                return nil
            }
        }

        return nil
    }

    private func sleepMetric(for stage: String) -> String {
        switch stage {
        case "in_bed":
            return "sleep_in_bed"
        case "awake":
            return "sleep_awake"
        case "asleep_core":
            return "sleep_core"
        case "asleep_deep":
            return "sleep_deep"
        case "asleep_rem":
            return "sleep_rem"
        default:
            return "sleep_asleep"
        }
    }

    private func isAsleepStage(_ stage: String) -> Bool {
        [
            "asleep_unspecified",
            "asleep_core",
            "asleep_deep",
            "asleep_rem",
        ].contains(stage)
    }

    private func sleepTimezone(for sample: HKCategorySample) -> String {
        metadataTimezone(for: sample) ?? TimeZone.current.identifier
    }

    private func metadataTimezone(for sample: HKSample) -> String? {
        sample.metadata?[HKMetadataKeyTimeZone] as? String
    }

    private func localDateString(from date: Date, timezone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = timezone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private func workoutActivityName(_ activity: HKWorkoutActivityType) -> String {
        switch activity {
        case .walking:
            return "walking"
        case .running:
            return "running"
        case .cycling:
            return "cycling"
        case .swimming:
            return "swimming"
        case .hiking:
            return "hiking"
        case .rowing:
            return "rowing"
        case .elliptical:
            return "elliptical"
        case .stairClimbing:
            return "stair_climbing"
        case .yoga:
            return "yoga"
        case .pilates:
            return "pilates"
        case .traditionalStrengthTraining:
            return "traditional_strength_training"
        case .functionalStrengthTraining:
            return "functional_strength_training"
        case .highIntensityIntervalTraining:
            return "high_intensity_interval_training"
        case .coreTraining:
            return "core_training"
        case .crossTraining:
            return "cross_training"
        case .mixedCardio:
            return "mixed_cardio"
        case .dance:
            return "dance"
        case .cooldown:
            return "cooldown"
        case .other:
            return "other"
        default:
            return "activity_\(activity.rawValue)"
        }
    }

    private func loadAnchor(forKey key: String) -> HKQueryAnchor? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? NSKeyedUnarchiver.unarchivedObject(
            ofClass: HKQueryAnchor.self,
            from: data
        )
    }

    private func saveAnchor(_ anchor: HKQueryAnchor, forKey key: String) throws {
        let data = try NSKeyedArchiver.archivedData(
            withRootObject: anchor,
            requiringSecureCoding: true
        )
        defaults.set(data, forKey: key)
    }
}
