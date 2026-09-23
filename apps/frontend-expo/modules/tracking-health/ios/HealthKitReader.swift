import Foundation
import HealthKit
import CoreLocation
import UIKit
import UserNotifications

final class HealthKitReader {
    private enum DefaultsKey {
        static let deviceId = "appleHealth.deviceId"
        static let workoutAnchor = "appleHealth.workoutAnchor"
        static let sleepAnchor = "appleHealth.sleepAnchor"
        static let initialSyncStartAt = "appleHealth.initialSyncStartAt"
        static let completedInitialSync = "appleHealth.completedInitialSync"
        static let workoutDetectionEnabled = "appleHealth.workoutDetectionEnabled"
        static let lastWorkoutNotificationEnd = "appleHealth.lastWorkoutNotificationEnd"
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

    private struct WorkoutEffortValues {
        var reported: Double?
        var estimated: Double?
    }

    private struct WorkoutRoutePayload {
        let elevationProfile: [ElevationProfilePoint]?
        let route: [WorkoutRoutePoint]?
    }

    private let defaultMaximumHeartRateBpm = 200.0
    private let maximumElevationProfilePoints = 120
    private let maximumHeartRateSeriesPoints = 240
    private let maximumDistanceTimeSeriesPoints = 240
    private let maximumRoutePoints = 240

    private let healthStore = HKHealthStore()
    private let defaults: UserDefaults
    private let pendingLock = NSLock()
    private var pendingAnchors: [String: PendingHealthKitAnchors] = [:]
    private var workoutObserverQuery: HKObserverQuery?

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    var requestedDataTypeNames: [String] {
        var names = quantityDefinitions.map(\.metric) + [
            "workout",
            "sleep_analysis",
            "heart_rate",
            "distance_walking_running",
            "workout_route",
        ]
        if #available(iOS 18.0, *) {
            names += ["workout_effort_score", "estimated_workout_effort_score"]
        }
        return names
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

    func setWorkoutDetectionEnabled(
        _ enabled: Bool,
        completion: @escaping (Result<Void, Error>) -> Void
    ) {
        defaults.set(enabled, forKey: DefaultsKey.workoutDetectionEnabled)
        if !enabled {
            stopWorkoutObservation()
            healthStore.disableBackgroundDelivery(for: HKObjectType.workoutType()) { success, error in
                if let error { completion(.failure(error)) }
                else if success { completion(.success(())) }
                else { completion(.failure(HealthKitReaderError.invalidPayload)) }
            }
            return
        }

        if defaults.object(forKey: DefaultsKey.lastWorkoutNotificationEnd) == nil {
            defaults.set(Date(), forKey: DefaultsKey.lastWorkoutNotificationEnd)
        }
        startWorkoutObservation()
        healthStore.enableBackgroundDelivery(for: HKObjectType.workoutType(), frequency: .immediate) { success, error in
            if let error { completion(.failure(error)) }
            else if success { completion(.success(())) }
            else { completion(.failure(HealthKitReaderError.invalidPayload)) }
        }
    }

    func stopWorkoutObservation() {
        if let workoutObserverQuery { healthStore.stop(workoutObserverQuery) }
        workoutObserverQuery = nil
    }

    private func startWorkoutObservation() {
        guard workoutObserverQuery == nil else { return }
        let workoutType = HKObjectType.workoutType()
        let query = HKObserverQuery(sampleType: workoutType, predicate: nil) { [weak self] _, completion, error in
            guard error == nil, let self else { completion(); return }
            self.notifyForNewestWorkout(completion: completion)
        }
        workoutObserverQuery = query
        healthStore.execute(query)
    }

    private func notifyForNewestWorkout(completion: @escaping () -> Void) {
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: nil,
            limit: 1,
            sortDescriptors: [sort]
        ) { [weak self] _, samples, _ in
            guard let self, let workout = samples?.first as? HKWorkout else { completion(); return }
            let lastEnd = self.defaults.object(forKey: DefaultsKey.lastWorkoutNotificationEnd) as? Date ?? .distantPast
            guard workout.endDate > lastEnd else { completion(); return }
            self.defaults.set(workout.endDate, forKey: DefaultsKey.lastWorkoutNotificationEnd)
            guard UIApplication.shared.applicationState != .active else { completion(); return }

            UNUserNotificationCenter.current().getNotificationSettings { settings in
                guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
                    completion()
                    return
                }
                let content = UNMutableNotificationContent()
                content.title = "Workout detected"
                content.body = "Open tracking.so to review and log your Apple Watch workout."
                content.sound = .default
                content.userInfo = ["url": "trackingso://health?review=1"]
                let request = UNNotificationRequest(
                    identifier: "apple-health-workout-\(workout.uuid.uuidString)",
                    content: content,
                    trigger: nil
                )
                UNUserNotificationCenter.current().add(request) { _ in completion() }
            }
        }
        healthStore.execute(query)
    }

    func prepareSync(
        initialLookbackDays: Int,
        refreshLookbackDays: Int,
        estimatedMaxHeartRateBpm: Int?,
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
            var workoutSnapshot: [HKWorkout] = []
            var effortByWorkoutId: [UUID: WorkoutEffortValues] = [:]
            var heartRateSamplesByWorkoutId: [UUID: [HKQuantitySample]] = [:]
            var distanceSamplesByWorkoutId: [UUID: [HKQuantitySample]] = [:]
            var routePayloadsByWorkoutId: [UUID: WorkoutRoutePayload] = [:]

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

            // Re-read the recent window so newly-added effort ratings and heart-rate
            // samples can enrich an existing workout even when its workout anchor is unchanged.
            group.enter()
            queryWorkoutSnapshot(startAt: startAt, endAt: now) { result in
                resultLock.lock()
                let workouts: [HKWorkout]
                if case let .success(value) = result {
                    workouts = value
                    workoutSnapshot = value
                } else {
                    workouts = []
                }
                resultLock.unlock()

                let runningWorkouts = workouts.filter {
                    $0.workoutActivityType == .running
                }
                guard !runningWorkouts.isEmpty else {
                    group.leave()
                    return
                }
                let enrichmentGroup = DispatchGroup()
                enrichmentGroup.enter()
                self.queryWorkoutHeartRateSamples(for: runningWorkouts) { values in
                    resultLock.lock()
                    heartRateSamplesByWorkoutId = values
                    resultLock.unlock()
                    enrichmentGroup.leave()
                }
                enrichmentGroup.enter()
                self.queryWorkoutDistanceSamples(for: runningWorkouts) { values in
                    resultLock.lock()
                    distanceSamplesByWorkoutId = values
                    resultLock.unlock()
                    enrichmentGroup.leave()
                }
                enrichmentGroup.enter()
                self.queryWorkoutRoutes(for: runningWorkouts) { values in
                    resultLock.lock()
                    routePayloadsByWorkoutId = values
                    resultLock.unlock()
                    enrichmentGroup.leave()
                }
                enrichmentGroup.notify(queue: .global(qos: .userInitiated)) {
                    group.leave()
                }
            }

            if #available(iOS 18.0, *) {
                group.enter()
                queryWorkoutEffortRelationships(startAt: startAt, endAt: now) { result in
                    resultLock.lock()
                    if case let .success(values) = result {
                        effortByWorkoutId = values
                    }
                    resultLock.unlock()
                    group.leave()
                }
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

                let sleepDailyMetrics: [HealthDailyMetricPayload] = []
                let anchoredWorkouts = workoutResult.added.compactMap { $0 as? HKWorkout }
                let workoutsById = Dictionary(
                    (anchoredWorkouts + workoutSnapshot).map { ($0.uuid, $0) },
                    uniquingKeysWith: { _, latest in latest }
                )
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
                    workouts: workoutsById.values
                        .sorted { $0.startDate < $1.startDate }
                        .map {
                            self.makeWorkoutPayload(
                                $0,
                                effort: effortByWorkoutId[$0.uuid],
                                heartRateSamples: heartRateSamplesByWorkoutId[$0.uuid] ?? [],
                                distanceSamples: distanceSamplesByWorkoutId[$0.uuid] ?? [],
                                routePayload: routePayloadsByWorkoutId[$0.uuid],
                                estimatedMaxHeartRateBpm: estimatedMaxHeartRateBpm.map(Double.init)
                            )
                        },
                    sleepSamples: sleepResult.added.compactMap {
                        ($0 as? HKCategorySample).flatMap(self.makeSleepSamplePayload)
                    },
                    deletedWorkoutIds: workoutResult.deletedExternalIds,
                    deletedSleepSampleIds: sleepResult.deletedExternalIds
                )

                self.pendingLock.lock()
                self.pendingAnchors.removeAll()
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
        let perMinute = HKUnit.count().unitDivided(by: HKUnit.minute())
        let milliseconds = HKUnit.secondUnit(with: .milli)

        return [
            QuantityDefinition(
                identifier: .restingHeartRate,
                metric: "resting_heart_rate",
                aggregation: .mostRecent,
                unit: perMinute,
                payloadUnit: "bpm",
                multiplier: 1
            ),
            QuantityDefinition(
                identifier: .heartRateVariabilitySDNN,
                metric: "heart_rate_variability_sdnn",
                aggregation: .average,
                unit: milliseconds,
                payloadUnit: "ms",
                multiplier: 1
            ),
            QuantityDefinition(
                identifier: .respiratoryRate,
                metric: "respiratory_rate",
                aggregation: .average,
                unit: perMinute,
                payloadUnit: "breaths/min",
                multiplier: 1
            ),
            QuantityDefinition(
                identifier: .oxygenSaturation,
                metric: "oxygen_saturation",
                aggregation: .average,
                unit: HKUnit.percent(),
                payloadUnit: "%",
                multiplier: 100
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
        guard let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            throw HealthKitReaderError.missingHealthType("heart_rate")
        }
        types.insert(heartRate)
        guard let distance = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) else {
            throw HealthKitReaderError.missingHealthType("distance_walking_running")
        }
        types.insert(distance)
        types.insert(HKSeriesType.workoutRoute())
        if #available(iOS 18.0, *) {
            guard
                let reportedEffort = HKObjectType.quantityType(forIdentifier: .workoutEffortScore),
                let estimatedEffort = HKObjectType.quantityType(forIdentifier: .estimatedWorkoutEffortScore)
            else {
                throw HealthKitReaderError.missingHealthType("workout_effort_score")
            }
            types.insert(reportedEffort)
            types.insert(estimatedEffort)
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

    private func queryWorkoutSnapshot(
        startAt: Date,
        endAt: Date,
        completion: @escaping (Result<[HKWorkout], Error>) -> Void
    ) {
        let predicate = HKQuery.predicateForSamples(
            withStart: startAt,
            end: endAt,
            options: [.strictStartDate]
        )
        let query = HKSampleQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: nil
        ) { _, samples, error in
            if let error {
                completion(.failure(error))
                return
            }
            completion(.success((samples as? [HKWorkout]) ?? []))
        }
        healthStore.execute(query)
    }

    private func queryWorkoutHeartRateSamples(
        for workouts: [HKWorkout],
        completion: @escaping ([UUID: [HKQuantitySample]]) -> Void
    ) {
        guard let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            completion([:])
            return
        }

        let group = DispatchGroup()
        let resultLock = NSLock()
        var samplesByWorkoutId: [UUID: [HKQuantitySample]] = [:]

        for workout in workouts {
            group.enter()
            let workoutPredicate = HKQuery.predicateForObjects(from: workout)
            let timePredicate = HKQuery.predicateForSamples(
                withStart: workout.startDate,
                end: workout.endDate,
                options: []
            )
            let predicate = NSCompoundPredicate(
                andPredicateWithSubpredicates: [workoutPredicate, timePredicate]
            )
            let query = HKSampleQuery(
                sampleType: heartRateType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [
                    NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true),
                ]
            ) { [weak self] _, samples, _ in
                let associated = (samples as? [HKQuantitySample]) ?? []
                guard associated.isEmpty, let self else {
                    resultLock.lock()
                    samplesByWorkoutId[workout.uuid] = associated
                    resultLock.unlock()
                    group.leave()
                    return
                }

                // Some HealthKit writers save heart-rate samples inside the
                // workout window without attaching the workout UUID. Keep the
                // association-first query, but fall back to the time window so
                // older Apple Watch workouts can still be enriched.
                let fallback = HKSampleQuery(
                    sampleType: heartRateType,
                    predicate: timePredicate,
                    limit: HKObjectQueryNoLimit,
                    sortDescriptors: [
                        NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true),
                    ]
                ) { _, fallbackSamples, _ in
                    resultLock.lock()
                    samplesByWorkoutId[workout.uuid] = (fallbackSamples as? [HKQuantitySample]) ?? []
                    resultLock.unlock()
                    group.leave()
                }
                self.healthStore.execute(fallback)
            }
            healthStore.execute(query)
        }

        group.notify(queue: .global(qos: .userInitiated)) {
            completion(samplesByWorkoutId)
        }
    }

    private func queryWorkoutDistanceSamples(
        for workouts: [HKWorkout],
        completion: @escaping ([UUID: [HKQuantitySample]]) -> Void
    ) {
        guard let distanceType = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) else {
            completion([:])
            return
        }
        let group = DispatchGroup()
        let lock = NSLock()
        var result: [UUID: [HKQuantitySample]] = [:]
        for workout in workouts {
            group.enter()
            // Association is required: nearby runs or other distance sources must not
            // be combined into this workout's cumulative distance.
            let predicate = HKQuery.predicateForObjects(from: workout)
            let query = HKSampleQuery(
                sampleType: distanceType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: true)]
            ) { _, samples, _ in
                lock.lock()
                result[workout.uuid] = (samples as? [HKQuantitySample]) ?? []
                lock.unlock()
                group.leave()
            }
            healthStore.execute(query)
        }
        group.notify(queue: .global(qos: .userInitiated)) { completion(result) }
    }

    private func queryWorkoutRoutes(
        for workouts: [HKWorkout],
        completion: @escaping ([UUID: WorkoutRoutePayload]) -> Void
    ) {
        guard !workouts.isEmpty else {
            completion([:])
            return
        }

        let routeType = HKSeriesType.workoutRoute()
        let group = DispatchGroup()
        let resultLock = NSLock()
        var payloadsByWorkoutId: [UUID: WorkoutRoutePayload] = [:]

        for workout in workouts {
            group.enter()
            // Route samples created by older watchOS versions are not always
            // linked by HKQuery.predicateForObjects(from:). Query the workout
            // window as a fallback-compatible primary query instead.
            let routePredicate = HKQuery.predicateForSamples(
                withStart: workout.startDate,
                end: workout.endDate,
                options: []
            )
            let sampleQuery = HKSampleQuery(
                sampleType: routeType,
                predicate: routePredicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: nil
            ) { [weak self] _, samples, _ in
                guard let self else {
                    group.leave()
                    return
                }

                let routes = ((samples as? [HKWorkoutRoute]) ?? []).filter {
                    $0.startDate < workout.endDate && $0.endDate > workout.startDate
                }
                guard !routes.isEmpty else {
                    group.leave()
                    return
                }

                let routeGroup = DispatchGroup()
                let locationsLock = NSLock()
                var locations: [CLLocation] = []
                for route in routes {
                    routeGroup.enter()
                    let routeQuery = HKWorkoutRouteQuery(route: route) { query, routeData, done, error in
                        if let routeData {
                            locationsLock.lock()
                            locations.append(contentsOf: routeData)
                            locationsLock.unlock()
                        }
                        if done || error != nil {
                            self.healthStore.stop(query)
                            routeGroup.leave()
                        }
                    }
                    self.healthStore.execute(routeQuery)
                }

                routeGroup.notify(queue: .global(qos: .userInitiated)) {
                    if let payload = self.makeWorkoutRoutePayload(from: locations) {
                        resultLock.lock()
                        payloadsByWorkoutId[workout.uuid] = payload
                        resultLock.unlock()
                    }
                    group.leave()
                }
            }
            healthStore.execute(sampleQuery)
        }

        group.notify(queue: .global(qos: .userInitiated)) {
            completion(payloadsByWorkoutId)
        }
    }

    private func makeWorkoutRoutePayload(from locations: [CLLocation]) -> WorkoutRoutePayload? {
        let ordered = locations
            .filter {
                $0.coordinate.latitude.isFinite && $0.coordinate.longitude.isFinite
            }
            .sorted { $0.timestamp < $1.timestamp }
        guard ordered.count >= 2 else { return nil }

        var routePoints: [WorkoutRoutePoint] = []
        routePoints.reserveCapacity(ordered.count)
        var distance = 0.0
        var previous: CLLocation?
        for location in ordered {
            if let previous {
                let segment = previous.distance(from: location)
                if segment.isFinite && segment >= 0 {
                    distance += segment
                }
            }
            routePoints.append(
                WorkoutRoutePoint(
                    latitude: location.coordinate.latitude,
                    longitude: location.coordinate.longitude,
                    distanceMeters: distance,
                    elevationMeters: location.verticalAccuracy >= 0 && location.altitude.isFinite
                        ? location.altitude
                        : nil
                )
            )
            previous = location
        }

        guard routePoints.count >= 2, distance > 0 else { return nil }
        let route = downsample(routePoints, maximumCount: maximumRoutePoints)
        let elevationPoints = routePoints.compactMap { point -> ElevationProfilePoint? in
            guard let elevationMeters = point.elevationMeters else { return nil }
            return ElevationProfilePoint(
                distanceMeters: point.distanceMeters,
                elevationMeters: elevationMeters
            )
        }
        let profile = elevationPoints.count >= 2
            ? downsample(elevationPoints, maximumCount: maximumElevationProfilePoints)
            : nil
        return WorkoutRoutePayload(elevationProfile: profile, route: route)
    }

    private func downsample<T>(_ points: [T], maximumCount: Int) -> [T] {
        guard points.count > maximumCount, maximumCount > 1 else { return points }
        let lastIndex = points.count - 1
        return (0..<maximumCount).map { index in
            let sourceIndex = Int(
                (Double(index) * Double(lastIndex) / Double(maximumCount - 1)).rounded()
            )
            return points[min(lastIndex, sourceIndex)]
        }
    }

    @available(iOS 18.0, *)
    private func queryWorkoutEffortRelationships(
        startAt: Date,
        endAt: Date,
        completion: @escaping (Result<[UUID: WorkoutEffortValues], Error>) -> Void
    ) {
        let predicate = HKQuery.predicateForSamples(
            withStart: startAt,
            end: endAt,
            options: [.strictStartDate]
        )
        let query = HKWorkoutEffortRelationshipQuery(
            predicate: predicate,
            anchor: nil,
            options: .default
        ) { [weak self] query, relationships, _, error in
            self?.healthStore.stop(query)
            if let error {
                completion(.failure(error))
                return
            }

            var valuesByWorkoutId: [UUID: WorkoutEffortValues] = [:]
            for relationship in relationships ?? [] {
                var values = valuesByWorkoutId[relationship.workout.uuid] ?? WorkoutEffortValues()
                for sample in relationship.samples ?? [] {
                    guard let quantitySample = sample as? HKQuantitySample else { continue }
                    let score = quantitySample.quantity.doubleValue(for: .appleEffortScore())
                    guard score.isFinite, (1 ... 10).contains(score) else { continue }
                    switch quantitySample.quantityType.identifier {
                    case HKQuantityTypeIdentifier.workoutEffortScore.rawValue:
                        values.reported = score
                    case HKQuantityTypeIdentifier.estimatedWorkoutEffortScore.rawValue:
                        values.estimated = score
                    default:
                        continue
                    }
                }
                valuesByWorkoutId[relationship.workout.uuid] = values
            }
            completion(.success(valuesByWorkoutId))
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

    private func makeWorkoutPayload(
        _ workout: HKWorkout,
        effort: WorkoutEffortValues?,
        heartRateSamples: [HKQuantitySample],
        distanceSamples: [HKQuantitySample],
        routePayload: WorkoutRoutePayload?,
        estimatedMaxHeartRateBpm: Double?
    ) -> HealthWorkoutPayload {
        let source = workout.sourceRevision.source
        let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate)
            .flatMap { workout.statistics(for: $0) }
        let beatsPerMinute = HKUnit.count().unitDivided(by: .minute())
        let heartRateZones = workout.workoutActivityType == .running
            ? makeHeartRateZones(
                from: heartRateSamples,
                estimatedMaxHeartRateBpm: estimatedMaxHeartRateBpm
            )
            : nil
        return HealthWorkoutPayload(
            externalId: workout.uuid.uuidString,
            activityTypeCode: Int(workout.workoutActivityType.rawValue),
            activityTypeName: workoutActivityName(workout.workoutActivityType),
            startAt: ISO8601DateFormatter.healthKit.string(from: workout.startDate),
            endAt: ISO8601DateFormatter.healthKit.string(from: workout.endDate),
            durationSeconds: workout.duration,
            activeEnergyKcal: workout.totalEnergyBurned?.doubleValue(for: .largeCalorie()),
            distanceMeters: workout.totalDistance?.doubleValue(for: .meter()),
            elevationAscendedMeters: metadataQuantityValue(
                HKMetadataKeyElevationAscended,
                from: workout
            ),
            elevationDescendedMeters: metadataQuantityValue(
                HKMetadataKeyElevationDescended,
                from: workout
            ),
            workoutEffortScore: effort?.reported,
            estimatedWorkoutEffortScore: effort?.estimated,
            averageHeartRateBpm: heartRate?.averageQuantity()?.doubleValue(for: beatsPerMinute),
            maximumHeartRateBpm: heartRate?.maximumQuantity()?.doubleValue(for: beatsPerMinute),
            heartRateZones: heartRateZones,
            heartRateSeries: workout.workoutActivityType == .running
                ? makeHeartRateSeries(
                    from: heartRateSamples,
                    workoutStart: workout.startDate,
                    workoutDuration: workout.endDate.timeIntervalSince(workout.startDate)
                )
                : nil,
            distanceTimeSeries: workout.workoutActivityType == .running
                ? makeDistanceTimeSeries(from: distanceSamples, workout: workout)
                : nil,
            elevationProfile: routePayload?.elevationProfile,
            route: routePayload?.route,
            sourceBundleId: source.bundleIdentifier,
            sourceName: source.name,
            sourceProductType: workout.sourceRevision.productType,
            deviceName: workout.device?.name,
            deviceModel: workout.device?.model,
            timezone: metadataTimezone(for: workout)
        )
    }

    private func makeDistanceTimeSeries(
        from samples: [HKQuantitySample],
        workout: HKWorkout
    ) -> [DistanceTimeSeriesPoint]? {
        guard !samples.isEmpty else { return nil }
        let ordered = samples.sorted { $0.endDate < $1.endDate }
        var cumulativeMeters = 0.0
        var points = [DistanceTimeSeriesPoint(elapsedSeconds: 0, distanceMeters: 0)]
        for sample in ordered {
            let meters = sample.quantity.doubleValue(for: .meter())
            let elapsed = sample.endDate.timeIntervalSince(workout.startDate)
            guard meters.isFinite, meters >= 0, elapsed.isFinite,
                  elapsed >= 0, elapsed <= workout.endDate.timeIntervalSince(workout.startDate) + 1,
                  elapsed >= points[points.count - 1].elapsedSeconds else { continue }
            cumulativeMeters += meters
            let point = DistanceTimeSeriesPoint(elapsedSeconds: elapsed, distanceMeters: cumulativeMeters)
            if elapsed == points[points.count - 1].elapsedSeconds {
                points[points.count - 1] = point
            } else {
                points.append(point)
            }
        }
        guard points.count >= 2, cumulativeMeters > 0 else { return nil }
        return downsample(points, maximumCount: maximumDistanceTimeSeriesPoints)
    }

    private func makeHeartRateSeries(
        from samples: [HKQuantitySample],
        workoutStart: Date,
        workoutDuration: TimeInterval
    ) -> [HeartRateSeriesPoint]? {
        let beatsPerMinute = HKUnit.count().unitDivided(by: .minute())
        let points = samples
            .sorted { $0.startDate < $1.startDate }
            .compactMap { sample -> HeartRateSeriesPoint? in
                let bpm = sample.quantity.doubleValue(for: beatsPerMinute)
                let elapsedSeconds = min(
                    max(0, sample.startDate.timeIntervalSince(workoutStart)),
                    max(0, workoutDuration)
                )
                guard bpm.isFinite, bpm > 0, elapsedSeconds.isFinite else { return nil }
                return HeartRateSeriesPoint(elapsedSeconds: elapsedSeconds, bpm: bpm)
            }
        guard points.count >= 2 else { return nil }
        return downsample(points, maximumCount: maximumHeartRateSeriesPoints)
    }

    private func makeHeartRateZones(
        from samples: [HKQuantitySample],
        estimatedMaxHeartRateBpm: Double?
    ) -> HeartRateZonesPayload? {
        guard !samples.isEmpty else { return nil }

        let maxHeartRate = estimatedMaxHeartRateBpm ?? defaultMaximumHeartRateBpm
        guard maxHeartRate.isFinite, maxHeartRate > 0 else { return nil }

        let sortedSamples = samples.sorted { $0.startDate < $1.startDate }
        let beatsPerMinute = HKUnit.count().unitDivided(by: .minute())
        var zoneSeconds = [Double](repeating: 0, count: 5)

        for (index, sample) in sortedSamples.enumerated() {
            let sampleDuration = sample.endDate.timeIntervalSince(sample.startDate)
            let nextSampleDuration: TimeInterval
            if index + 1 < sortedSamples.count {
                nextSampleDuration = sortedSamples[index + 1].startDate.timeIntervalSince(sample.startDate)
            } else {
                nextSampleDuration = 0
            }
            let duration = sampleDuration > 0
                ? sampleDuration
                : min(max(0, nextSampleDuration), 60)
            guard duration > 0, duration.isFinite else { continue }

            let heartRate = sample.quantity.doubleValue(for: beatsPerMinute)
            guard heartRate.isFinite, heartRate > 0 else { continue }
            let intensity = heartRate / maxHeartRate
            let zone: Int
            if intensity < 0.6 {
                zone = 0
            } else if intensity < 0.7 {
                zone = 1
            } else if intensity < 0.8 {
                zone = 2
            } else if intensity < 0.9 {
                zone = 3
            } else {
                zone = 4
            }
            zoneSeconds[zone] += duration
        }

        guard zoneSeconds.contains(where: { $0 > 0 }) else { return nil }
        return HeartRateZonesPayload(
            estimatedMaxHeartRateBpm: maxHeartRate,
            source: estimatedMaxHeartRateBpm == nil ? "default" : "age_estimate",
            zone1Seconds: zoneSeconds[0],
            zone2Seconds: zoneSeconds[1],
            zone3Seconds: zoneSeconds[2],
            zone4Seconds: zoneSeconds[3],
            zone5Seconds: zoneSeconds[4]
        )
    }

    private func metadataQuantityValue(_ key: String, from workout: HKWorkout) -> Double? {
        guard let quantity = workout.metadata?[key] as? HKQuantity else { return nil }
        let value = quantity.doubleValue(for: .meter())
        return value.isFinite && value >= 0 ? value : nil
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
