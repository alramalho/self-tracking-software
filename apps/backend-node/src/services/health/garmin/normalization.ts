import type {
  GarminActivityDetail,
  GarminDailyMetricInput,
  GarminJsonObject,
  GarminNormalizedData,
  GarminSleepSampleInput,
  GarminWebhookRecord,
  GarminWorkoutInput,
} from "./types";

export const GARMIN_HEALTH_PROVIDER = "garmin_connect";
export const GARMIN_SOURCE = "__garmin_connect__";
export const GARMIN_SOURCE_NAME = "Garmin Connect";

const MAX_DETAIL_POINTS = 240;

const canonicalKey = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

function objectValue(value: unknown): GarminJsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as GarminJsonObject)
    : null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function valueFor(object: GarminJsonObject | null, names: string[]): unknown {
  if (!object) return undefined;
  const wanted = new Set(names.map(canonicalKey));
  const entry = Object.entries(object).find(([key]) =>
    wanted.has(canonicalKey(key)),
  );
  return entry?.[1];
}

function numberFor(
  object: GarminJsonObject | null,
  names: string[],
): number | undefined {
  const value = valueFor(object, names);
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function stringFor(
  object: GarminJsonObject | null,
  names: string[],
): string | undefined {
  const value = valueFor(object, names);
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const result = String(value).trim();
  return result || undefined;
}

function dateFromSeconds(value: number | undefined): Date | null {
  if (value == null || !Number.isFinite(value)) return null;
  const milliseconds = value > 100_000_000_000 ? value : value * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

function secondsFromTimestamp(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return value > 100_000_000_000 ? value / 1000 : value;
}

function localDateFor(
  object: GarminJsonObject | null,
  startTimeInSeconds: number | undefined,
): string | undefined {
  const supplied = stringFor(object, ["calendarDate", "CalendarDate"]);
  if (supplied && /^\d{4}-\d{2}-\d{2}$/.test(supplied)) return supplied;

  const start = dateFromSeconds(startTimeInSeconds);
  if (!start) return undefined;
  const offset = numberFor(object, ["startTimeOffsetInSeconds"]);
  const local = new Date(start.getTime() + (offset ?? 0) * 1000);
  return local.toISOString().slice(0, 10);
}

function metadataValue(value: GarminJsonObject): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function metric(
  localDate: string | undefined,
  name: string,
  aggregation: string,
  value: number | undefined,
  unit: string,
  summaryType: string,
  summaryId: string | undefined,
  sampleCount?: number,
): GarminDailyMetricInput | null {
  if (!localDate || value == null || !Number.isFinite(value)) return null;
  return {
    localDate,
    metric: name,
    aggregation,
    value,
    unit,
    sourceBundleId: GARMIN_SOURCE,
    sourceName: GARMIN_SOURCE_NAME,
    ...(sampleCount == null ? {} : { sampleCount }),
    metadata: {
      provider: GARMIN_HEALTH_PROVIDER,
      summaryType,
      ...(summaryId ? { summaryId } : {}),
    },
  };
}

function pushMetric(
  output: GarminDailyMetricInput[],
  localDate: string | undefined,
  name: string,
  aggregation: string,
  value: number | undefined,
  unit: string,
  summaryType: string,
  summaryId: string | undefined,
  sampleCount?: number,
): void {
  const valueToAdd = metric(
    localDate,
    name,
    aggregation,
    value,
    unit,
    summaryType,
    summaryId,
    sampleCount,
  );
  if (valueToAdd) output.push(valueToAdd);
}

function mapValues(value: unknown): Array<[number, number]> {
  const object = objectValue(value);
  if (!object) return [];
  return Object.entries(object)
    .map(
      ([offset, sample]) =>
        [Number(offset), Number(sample)] as [number, number],
    )
    .filter(
      ([offset, sample]) => Number.isFinite(offset) && Number.isFinite(sample),
    );
}

function average(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function summaryIdFor(object: GarminJsonObject | null): string | undefined {
  return stringFor(object, [
    "summaryId",
    "SummaryId",
    "activityId",
    "ActivityId",
  ]);
}

function normalizeDailySummary(
  raw: GarminJsonObject,
  summaryType: string,
): GarminDailyMetricInput[] {
  const localDate = localDateFor(raw, numberFor(raw, ["startTimeInSeconds"]));
  const summaryId = summaryIdFor(raw);
  const metrics: GarminDailyMetricInput[] = [];

  pushMetric(
    metrics,
    localDate,
    "step_count",
    "sum",
    numberFor(raw, ["steps", "totalSteps"]),
    "count",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "active_energy_burned",
    "sum",
    numberFor(raw, ["activeKilocalories", "activeCalories"]) ??
      numberFor(raw, ["activeKilocaloriesTotal"]),
    "kcal",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "walking_running_distance",
    "sum",
    numberFor(raw, ["distanceInMeters", "totalDistanceInMeters"]),
    "m",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "flights_climbed",
    "sum",
    numberFor(raw, ["floorsClimbed", "floorsClimbedInFloors"]),
    "count",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "apple_exercise_time",
    "sum",
    numberFor(raw, ["activeTimeInSeconds"]),
    "s",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "resting_heart_rate",
    "most_recent",
    numberFor(raw, ["restingHeartRateInBeatsPerMinute", "restingHeartRate"]),
    "bpm",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "heart_rate_average",
    "average",
    numberFor(raw, ["averageHeartRateInBeatsPerMinute", "averageHeartRate"]),
    "bpm",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "heart_rate_minimum",
    "minimum",
    numberFor(raw, ["minHeartRateInBeatsPerMinute", "minHeartRate"]),
    "bpm",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "heart_rate_maximum",
    "maximum",
    numberFor(raw, ["maxHeartRateInBeatsPerMinute", "maxHeartRate"]),
    "bpm",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "moderate_intensity_duration",
    "sum",
    numberFor(raw, ["moderateIntensityDurationInSeconds"]),
    "s",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "vigorous_intensity_duration",
    "sum",
    numberFor(raw, ["vigorousIntensityDurationInSeconds"]),
    "s",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "stress_average",
    "average",
    numberFor(raw, ["averageStressLevel"]),
    "score",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "stress_maximum",
    "maximum",
    numberFor(raw, ["maxStressLevel", "maximumStressLevel"]),
    "score",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "body_battery_start",
    "most_recent",
    numberFor(raw, ["bodyBatteryAtStartOfDay", "bodyBatteryStartOfDay"]),
    "score",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "body_battery_end",
    "most_recent",
    numberFor(raw, ["bodyBatteryAtEndOfDay", "bodyBatteryEndOfDay"]),
    "score",
    summaryType,
    summaryId,
  );

  const heartRateSamples = mapValues(
    valueFor(raw, ["timeOffsetHeartRateSamples"]),
  );
  pushMetric(
    metrics,
    localDate,
    "heart_rate_average",
    "average",
    average(heartRateSamples.map(([, value]) => value)),
    "bpm",
    summaryType,
    summaryId,
    heartRateSamples.length,
  );

  return metrics;
}

function normalizeHrvSummary(
  raw: GarminJsonObject,
  summaryType: string,
): GarminDailyMetricInput[] {
  const localDate = localDateFor(raw, numberFor(raw, ["startTimeInSeconds"]));
  const summaryId = summaryIdFor(raw);
  const value =
    numberFor(raw, ["lastNightAvg", "lastNightAverage", "hrvValue"]) ??
    numberFor(objectValue(valueFor(raw, ["hrvSummary"])), ["lastNightAvg"]);
  const metrics: GarminDailyMetricInput[] = [];
  pushMetric(
    metrics,
    localDate,
    "heart_rate_variability_sdnn",
    "average",
    value,
    "ms",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "heart_rate_variability_high",
    "maximum",
    numberFor(raw, ["lastNight5MinHigh", "lastNightFiveMinuteHigh"]),
    "ms",
    summaryType,
    summaryId,
  );
  return metrics;
}

function normalizeRespirationSummary(
  raw: GarminJsonObject,
  summaryType: string,
): GarminDailyMetricInput[] {
  const localDate = localDateFor(raw, numberFor(raw, ["startTimeInSeconds"]));
  const summaryId = summaryIdFor(raw);
  const samples = mapValues(
    valueFor(raw, [
      "timeOffsetRespirationRateValues",
      "timeOffsetRespirationValues",
    ]),
  );
  const metrics: GarminDailyMetricInput[] = [];
  pushMetric(
    metrics,
    localDate,
    "respiratory_rate",
    "average",
    numberFor(raw, [
      "avgWakingRespirationValue",
      "averageRespirationRate",
      "averageRespirationRateInBreathsPerMinute",
    ]) ?? average(samples.map(([, value]) => value)),
    "breaths/min",
    summaryType,
    summaryId,
    samples.length || undefined,
  );
  return metrics;
}

function normalizePulseOxSummary(
  raw: GarminJsonObject,
  summaryType: string,
): GarminDailyMetricInput[] {
  const localDate = localDateFor(raw, numberFor(raw, ["startTimeInSeconds"]));
  const summaryId = summaryIdFor(raw);
  const samples = mapValues(
    valueFor(raw, [
      "timeOffsetSpo2",
      "timeOffsetSpo2Values",
      "timeOffsetPulseOx",
    ]),
  );
  const metrics: GarminDailyMetricInput[] = [];
  pushMetric(
    metrics,
    localDate,
    "oxygen_saturation",
    "average",
    numberFor(raw, ["averageSpO2", "averageSpo2", "averageOxygenSaturation"]) ??
      average(samples.map(([, value]) => value)),
    "%",
    summaryType,
    summaryId,
    samples.length || undefined,
  );
  return metrics;
}

function normalizeStressSummary(
  raw: GarminJsonObject,
  summaryType: string,
): GarminDailyMetricInput[] {
  const localDate = localDateFor(raw, numberFor(raw, ["startTimeInSeconds"]));
  const summaryId = summaryIdFor(raw);
  const samples = mapValues(valueFor(raw, ["timeOffsetStressLevelValues"]));
  const metrics: GarminDailyMetricInput[] = [];
  pushMetric(
    metrics,
    localDate,
    "stress_average",
    "average",
    numberFor(raw, ["averageStressLevel"]) ??
      average(samples.map(([, value]) => value)),
    "score",
    summaryType,
    summaryId,
    samples.length || undefined,
  );
  pushMetric(
    metrics,
    localDate,
    "stress_maximum",
    "maximum",
    numberFor(raw, ["maxStressLevel"]) ??
      (samples.length
        ? Math.max(...samples.map(([, value]) => value))
        : undefined),
    "score",
    summaryType,
    summaryId,
    samples.length || undefined,
  );
  return metrics;
}

function normalizeBodyCompositionSummary(
  raw: GarminJsonObject,
  summaryType: string,
): GarminDailyMetricInput[] {
  const localDate = localDateFor(raw, numberFor(raw, ["startTimeInSeconds"]));
  const summaryId = summaryIdFor(raw);
  const weightInGrams = numberFor(raw, ["weightInGrams"]);
  const weightInKilograms = numberFor(raw, ["weightInKilograms", "weightInKg"]);
  const metrics: GarminDailyMetricInput[] = [];
  pushMetric(
    metrics,
    localDate,
    "body_mass",
    "most_recent",
    weightInKilograms ??
      (weightInGrams == null ? undefined : weightInGrams / 1000),
    "kg",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "body_mass_index",
    "most_recent",
    numberFor(raw, ["bmi"]),
    "kg/m²",
    summaryType,
    summaryId,
  );
  bodyCompositionMetric(
    metrics,
    localDate,
    raw,
    "body_fat_percentage",
    ["bodyFatPercentage", "bodyFatPercent"],
    "%",
    summaryType,
    summaryId,
  );
  bodyCompositionMetric(
    metrics,
    localDate,
    raw,
    "muscle_mass",
    ["muscleMassInGrams", "muscleMassInKilograms"],
    weightInGrams == null ? "kg" : "g",
    summaryType,
    summaryId,
    weightInGrams == null ? 1 : 0.001,
  );
  return metrics;
}

function bodyCompositionMetric(
  metrics: GarminDailyMetricInput[],
  localDate: string | undefined,
  raw: GarminJsonObject,
  name: string,
  names: string[],
  unit: string,
  summaryType: string,
  summaryId: string | undefined,
  multiplier = 1,
): void {
  const value = numberFor(raw, names);
  pushMetric(
    metrics,
    localDate,
    name,
    "most_recent",
    value == null ? undefined : value * multiplier,
    unit,
    summaryType,
    summaryId,
  );
}

function normalizeUserMetricsSummary(
  raw: GarminJsonObject,
  summaryType: string,
): GarminDailyMetricInput[] {
  const localDate = localDateFor(raw, numberFor(raw, ["startTimeInSeconds"]));
  const summaryId = summaryIdFor(raw);
  const metrics: GarminDailyMetricInput[] = [];
  pushMetric(
    metrics,
    localDate,
    "vo2_max",
    "most_recent",
    numberFor(raw, ["vo2Max", "vo2MaxValue"]),
    "mL/kg/min",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "fitness_age",
    "most_recent",
    numberFor(raw, ["fitnessAge"]),
    "years",
    summaryType,
    summaryId,
  );
  return metrics;
}

function normalizeBloodPressureSummary(
  raw: GarminJsonObject,
  summaryType: string,
): GarminDailyMetricInput[] {
  const localDate = localDateFor(raw, numberFor(raw, ["startTimeInSeconds"]));
  const summaryId = summaryIdFor(raw);
  const metrics: GarminDailyMetricInput[] = [];
  pushMetric(
    metrics,
    localDate,
    "blood_pressure_systolic",
    "most_recent",
    numberFor(raw, [
      "systolicPressure",
      "systolicPressureInMillimetersOfMercury",
    ]),
    "mmHg",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "blood_pressure_diastolic",
    "most_recent",
    numberFor(raw, [
      "diastolicPressure",
      "diastolicPressureInMillimetersOfMercury",
    ]),
    "mmHg",
    summaryType,
    summaryId,
  );
  return metrics;
}

function stageName(value: string): GarminSleepSampleInput["stage"] | null {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "deep") return "asleep_deep";
  if (normalized === "light" || normalized === "core") return "asleep_core";
  if (normalized === "rem") return "asleep_rem";
  if (normalized === "awake" || normalized === "wake") return "awake";
  if (normalized === "unmeasurable") return "asleep_unspecified";
  return null;
}

function sleepLevels(
  raw: GarminJsonObject,
  summaryId: string,
): GarminSleepSampleInput[] {
  const levels = objectValue(valueFor(raw, ["sleepLevelsMap"]));
  if (!levels) return [];
  const samples: GarminSleepSampleInput[] = [];
  for (const [rawStage, rawRanges] of Object.entries(levels)) {
    const stage = stageName(rawStage);
    if (!stage) continue;
    for (const [index, rawRange] of arrayValue(rawRanges).entries()) {
      const range = objectValue(rawRange);
      const startSeconds = numberFor(range, ["startTimeInSeconds"]);
      const endSeconds = numberFor(range, ["endTimeInSeconds"]);
      const startAt = dateFromSeconds(startSeconds);
      const endAt = dateFromSeconds(endSeconds);
      if (!startAt || !endAt || endAt <= startAt) continue;
      samples.push({
        externalId: `${summaryId}:${stage}:${index}`,
        stageCode:
          stage === "awake"
            ? 1
            : stage === "asleep_core"
              ? 2
              : stage === "asleep_rem"
                ? 3
                : stage === "asleep_deep"
                  ? 4
                  : 0,
        stage,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        sourceBundleId: GARMIN_SOURCE,
        sourceName: GARMIN_SOURCE_NAME,
        sourceProductType: "sleep",
        metadata: {
          provider: GARMIN_HEALTH_PROVIDER,
          summaryId,
          validation: stringFor(raw, ["validation"]),
        },
      });
    }
  }
  return samples;
}

function normalizeSleepSummary(
  raw: GarminJsonObject,
  summaryType: string,
): { metrics: GarminDailyMetricInput[]; samples: GarminSleepSampleInput[] } {
  const localDate = localDateFor(raw, numberFor(raw, ["startTimeInSeconds"]));
  const summaryId = summaryIdFor(raw) ?? `sleep:${localDate ?? "unknown"}`;
  const deep = numberFor(raw, ["deepSleepDurationInSeconds"]) ?? 0;
  const light = numberFor(raw, ["lightSleepDurationInSeconds"]) ?? 0;
  const rem = numberFor(raw, ["remSleepInSeconds"]) ?? 0;
  const awake = numberFor(raw, ["awakeDurationInSeconds"]) ?? 0;
  const duration = numberFor(raw, ["durationInSeconds"]);
  const asleep = deep + light + rem;
  const metrics: GarminDailyMetricInput[] = [];
  pushMetric(
    metrics,
    localDate,
    "sleep_asleep",
    "duration",
    asleep || undefined,
    "s",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "sleep_in_bed",
    "duration",
    duration,
    "s",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "sleep_awake",
    "duration",
    awake || undefined,
    "s",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "sleep_core",
    "duration",
    light || undefined,
    "s",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "sleep_deep",
    "duration",
    deep || undefined,
    "s",
    summaryType,
    summaryId,
  );
  pushMetric(
    metrics,
    localDate,
    "sleep_rem",
    "duration",
    rem || undefined,
    "s",
    summaryType,
    summaryId,
  );
  const overallSleepScore = objectValue(valueFor(raw, ["overallSleepScore"]));
  const score = numberFor(overallSleepScore, ["value", "score"]);
  pushMetric(
    metrics,
    localDate,
    "sleep_score",
    "most_recent",
    score,
    "score",
    summaryType,
    summaryId,
  );
  return { metrics, samples: sleepLevels(raw, summaryId) };
}

function downsample<T>(values: T[], limit = MAX_DETAIL_POINTS): T[] {
  if (values.length <= limit) return values;
  return Array.from(
    { length: limit },
    (_, index) =>
      values[Math.floor((index * (values.length - 1)) / (limit - 1))],
  );
}

function descriptorNames(raw: GarminJsonObject): string[] {
  return arrayValue(valueFor(raw, ["metricDescriptors"]))
    .map((descriptor) =>
      stringFor(objectValue(descriptor), ["key", "name", "fieldName", "label"]),
    )
    .filter((value): value is string => Boolean(value));
}

function activityDetailSamples(raw: GarminJsonObject): GarminJsonObject[] {
  const rows = arrayValue(valueFor(raw, ["samples", "activityDetailMetrics"]));
  const names = descriptorNames(raw);
  return rows
    .map((row) => {
      if (!Array.isArray(row)) return objectValue(row);
      return Object.fromEntries(names.map((name, index) => [name, row[index]]));
    })
    .filter((row): row is GarminJsonObject => Boolean(row));
}

export function normalizeActivityDetail(
  raw: GarminJsonObject,
): GarminActivityDetail | null {
  const summary = objectValue(valueFor(raw, ["summary"])) ?? raw;
  const activityId =
    stringFor(raw, ["activityId", "ActivityId"]) ??
    stringFor(summary, ["activityId", "ActivityId"]);
  if (!activityId) return null;
  const startSeconds = numberFor(summary, ["startTimeInSeconds"]);
  const start = startSeconds == null ? null : secondsFromTimestamp(startSeconds) ?? null;
  const rows = activityDetailSamples(raw);
  const heartRates: Array<{ elapsedSeconds: number; bpm: number }> = [];
  const distances: Array<{ elapsedSeconds: number; distanceMeters: number }> = [];
  const elevation: Array<{ distanceMeters: number; elevationMeters: number }> =
    [];
  const route: Array<{
    latitude: number;
    longitude: number;
    distanceMeters: number;
    elevationMeters?: number;
  }> = [];

  for (const row of rows) {
    const timestamp = secondsFromTimestamp(
      numberFor(row, ["directTimestamp", "timestamp", "startTimeInSeconds"]),
    );
    const elapsed = timestamp != null && start != null
      ? timestamp - start
      : numberFor(row, ["elapsedTimeInSeconds", "timerDurationInSeconds"]);
    // Only absolute timestamps retain stopped time reliably. Keep the older
    // fallback for heart rate while omitting uncertain split clocks.
    const splitElapsed = timestamp != null && start != null
      ? timestamp - start
      : undefined;
    const heartRate = numberFor(row, [
      "directHeartRate",
      "heartRate",
      "HeartRate",
    ]);
    if (
      elapsed != null &&
      elapsed >= 0 &&
      heartRate != null &&
      heartRate > 0 &&
      heartRate <= 300
    ) {
      heartRates.push({ elapsedSeconds: elapsed, bpm: heartRate });
    }
    const distance = numberFor(row, [
      "totalDistanceInMeters",
      "distanceInMeters",
      "distance",
    ]);
    if (splitElapsed != null && splitElapsed >= 0 && distance != null && distance >= 0) {
      distances.push({ elapsedSeconds: splitElapsed, distanceMeters: distance });
    }
    const altitude = numberFor(row, [
      "elevationInMeters",
      "elevation",
      "altitude",
    ]);
    if (distance != null && distance >= 0 && altitude != null) {
      elevation.push({ distanceMeters: distance, elevationMeters: altitude });
    }
    const latitude = numberFor(row, ["latitudeInDegree", "latitude"]);
    const longitude = numberFor(row, ["longitudeInDegree", "longitude"]);
    if (
      latitude != null &&
      longitude != null &&
      distance != null &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      route.push({
        latitude,
        longitude,
        distanceMeters: distance,
        ...(altitude == null ? {} : { elevationMeters: altitude }),
      });
    }
  }

  return {
    activityId,
    averageHeartRateBpm: numberFor(summary, [
      "averageHeartRateInBeatsPerMinute",
    ]),
    maximumHeartRateBpm: numberFor(summary, ["maxHeartRateInBeatsPerMinute"]),
    ...(heartRates.length >= 2
      ? { heartRateSeries: downsample(heartRates) }
      : {}),
    ...(distances.length >= 2
      ? { distanceTimeSeries: downsample(distances) }
      : {}),
    ...(elevation.length >= 2
      ? { elevationProfile: downsample(elevation) }
      : {}),
    ...(route.length >= 2 ? { route: downsample(route) } : {}),
    metadata: {
      provider: GARMIN_HEALTH_PROVIDER,
      ...(stringFor(raw, ["summaryId", "SummaryId"])
        ? { summaryId: stringFor(raw, ["summaryId", "SummaryId"]) }
        : {}),
      ...(numberFor(summary, ["averageSpeedInMetersPerSecond"]) == null
        ? {}
        : {
            averageSpeedInMetersPerSecond: numberFor(summary, [
              "averageSpeedInMetersPerSecond",
            ]),
          }),
      ...(numberFor(summary, ["averagePaceInMinutesPerKilometer"]) == null
        ? {}
        : {
            averagePaceInMinutesPerKilometer: numberFor(summary, [
              "averagePaceInMinutesPerKilometer",
            ]),
          }),
      ...(numberFor(summary, ["averagePowerInWatts"]) == null
        ? {}
        : { averagePowerInWatts: numberFor(summary, ["averagePowerInWatts"]) }),
    },
  };
}

function activitySummary(raw: GarminJsonObject): GarminJsonObject {
  return objectValue(valueFor(raw, ["summary"])) ?? raw;
}

function normalizeActivity(
  raw: GarminJsonObject,
  detail: GarminActivityDetail | undefined,
): GarminWorkoutInput | null {
  const summary = activitySummary(raw);
  const activityId =
    stringFor(summary, ["activityId", "ActivityId"]) ??
    stringFor(raw, ["activityId", "ActivityId"]);
  const startSeconds = numberFor(summary, ["startTimeInSeconds"]);
  const durationSeconds = numberFor(summary, ["durationInSeconds"]);
  const startAt = dateFromSeconds(startSeconds);
  if (!activityId || !startAt || durationSeconds == null || durationSeconds < 0)
    return null;
  const endAt = new Date(startAt.getTime() + durationSeconds * 1000);
  const activityType =
    stringFor(summary, ["activityType", "ActivityType"]) ?? "OTHER";
  const detailMetadata = detail?.metadata ?? {};
  return {
    externalId: activityId,
    activityTypeCode: activityTypeCode(activityType),
    activityTypeName: activityType,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    durationSeconds,
    activeEnergyKcal: numberFor(summary, [
      "activeKilocalories",
      "activeCalories",
    ]),
    distanceMeters: numberFor(summary, [
      "distanceInMeters",
      "totalDistanceInMeters",
    ]),
    sourceBundleId: GARMIN_SOURCE,
    sourceName: GARMIN_SOURCE_NAME,
    sourceProductType: activityType,
    deviceName: stringFor(summary, ["deviceName", "DeviceName"]),
    metadata: {
      provider: GARMIN_HEALTH_PROVIDER,
      activityId,
      summaryId: stringFor(raw, ["summaryId", "SummaryId"]) ?? activityId,
      startTimeOffsetSeconds: numberFor(summary, ["startTimeOffsetInSeconds"]),
      elevationAscendedMeters: numberFor(summary, [
        "totalElevationGainInMeters",
      ]),
      elevationDescendedMeters: numberFor(summary, [
        "totalElevationLossInMeters",
      ]),
      averageHeartRateBpm:
        detail?.averageHeartRateBpm ??
        numberFor(summary, ["averageHeartRateInBeatsPerMinute"]),
      maximumHeartRateBpm:
        detail?.maximumHeartRateBpm ??
        numberFor(summary, ["maxHeartRateInBeatsPerMinute"]),
      ...(detail?.heartRateSeries
        ? { heartRateSeries: detail.heartRateSeries }
        : {}),
      ...(detail?.distanceTimeSeries
        ? { distanceTimeSeries: detail.distanceTimeSeries }
        : {}),
      ...(detail?.elevationProfile
        ? { elevationProfile: detail.elevationProfile }
        : {}),
      ...(detail?.route ? { route: detail.route } : {}),
      ...detailMetadata,
      ...(numberFor(summary, ["averagePaceInMinutesPerKilometer"]) == null
        ? {}
        : {
            averagePaceInMinutesPerKilometer: numberFor(summary, [
              "averagePaceInMinutesPerKilometer",
            ]),
          }),
      ...(numberFor(summary, ["averageSpeedInMetersPerSecond"]) == null
        ? {}
        : {
            averageSpeedInMetersPerSecond: numberFor(summary, [
              "averageSpeedInMetersPerSecond",
            ]),
          }),
    },
  };
}

export function activityTypeCode(value: string): number {
  let hash = 2166136261;
  for (const character of value.toUpperCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 2_000_000_000;
}

function recordsFromPayload(
  payload: unknown,
  summaryType?: string,
): GarminJsonObject[] {
  if (Array.isArray(payload)) {
    return payload
      .map(objectValue)
      .filter((value): value is GarminJsonObject => Boolean(value));
  }
  const object = objectValue(payload);
  if (!object) return [];
  const target = summaryType ? canonicalKey(summaryType) : null;
  const groupedEntry = target
    ? Object.entries(object).find(([key, value]) => {
        if (!Array.isArray(value)) return false;
        const candidate = canonicalKey(key);
        return candidate === target || candidate === `${target}s`;
      })
    : undefined;
  for (const key of [
    ...(groupedEntry ? [groupedEntry[0]] : []),
    "data",
    "summaries",
    "items",
    "results",
  ]) {
    const values = arrayValue(valueFor(object, [key]));
    if (values.length) {
      return values
        .map(objectValue)
        .filter((value): value is GarminJsonObject => Boolean(value));
    }
  }
  return [object];
}

export function normalizeGarminSummary(
  summaryType: string,
  payload: unknown,
): GarminNormalizedData {
  const records = recordsFromPayload(payload, summaryType);
  const dailyMetrics: GarminDailyMetricInput[] = [];
  const workouts: GarminWorkoutInput[] = [];
  const sleepSamples: GarminSleepSampleInput[] = [];
  const details =
    summaryType === "activityDetails"
      ? records
          .map(normalizeActivityDetail)
          .filter((value): value is GarminActivityDetail => Boolean(value))
      : [];
  const detailsByActivityId = new Map(
    details.map((detail) => [detail.activityId, detail]),
  );

  for (const record of records) {
    switch (summaryType) {
      case "dailies":
      case "epochs":
        dailyMetrics.push(...normalizeDailySummary(record, summaryType));
        break;
      case "hrv":
        dailyMetrics.push(...normalizeHrvSummary(record, summaryType));
        break;
      case "sleeps":
      case "sleep": {
        const sleep = normalizeSleepSummary(record, summaryType);
        dailyMetrics.push(...sleep.metrics);
        sleepSamples.push(...sleep.samples);
        break;
      }
      case "allDayRespiration":
        dailyMetrics.push(...normalizeRespirationSummary(record, summaryType));
        break;
      case "pulseox":
      case "pulseOx":
        dailyMetrics.push(...normalizePulseOxSummary(record, summaryType));
        break;
      case "stressDetails":
        dailyMetrics.push(...normalizeStressSummary(record, summaryType));
        break;
      case "bodyComps":
        dailyMetrics.push(
          ...normalizeBodyCompositionSummary(record, summaryType),
        );
        break;
      case "userMetrics":
        dailyMetrics.push(...normalizeUserMetricsSummary(record, summaryType));
        break;
      case "bloodPressures":
        dailyMetrics.push(
          ...normalizeBloodPressureSummary(record, summaryType),
        );
        break;
      case "activities":
      case "manuallyUpdatedActivities": {
        const activity = activitySummary(record);
        const activityId = stringFor(activity, ["activityId", "ActivityId"]);
        workouts.push(
          ...[
            normalizeActivity(
              record,
              activityId ? detailsByActivityId.get(activityId) : undefined,
            ),
          ].filter((value): value is GarminWorkoutInput => Boolean(value)),
        );
        break;
      }
      case "activityDetails": {
        const detail = normalizeActivityDetail(record);
        const activityId = detail?.activityId;
        if (activityId) {
          const activity = normalizeActivity(record, detail);
          if (activity) workouts.push(activity);
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    dailyMetrics,
    workouts,
    sleepSamples,
    summaryTypes: records.length ? [summaryType] : [],
  };
}

export function mergeGarminNormalizedData(
  target: GarminNormalizedData,
  next: GarminNormalizedData,
): GarminNormalizedData {
  return {
    dailyMetrics: [...target.dailyMetrics, ...next.dailyMetrics],
    workouts: [...target.workouts, ...next.workouts],
    sleepSamples: [...target.sleepSamples, ...next.sleepSamples],
    summaryTypes: [...new Set([...target.summaryTypes, ...next.summaryTypes])],
    uploadEndTimeSeconds:
      Math.max(
        target.uploadEndTimeSeconds ?? 0,
        next.uploadEndTimeSeconds ?? 0,
      ) || undefined,
  };
}

export function webhookRecord(value: unknown): GarminWebhookRecord | null {
  const object = objectValue(value);
  return object as GarminWebhookRecord | null;
}

export function payloadRecords(value: unknown): GarminWebhookRecord[] {
  return recordsFromPayload(value) as GarminWebhookRecord[];
}
