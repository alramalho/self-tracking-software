import type {
  Activity,
  ActivityEntry,
  HealthWorkout,
  Prisma,
} from "@tsw/prisma";

import { prisma } from "@/utils/prisma";

import type {
  ConfirmedWorkoutActivityMatch,
  HealthWorkoutPreview,
  NormalizedWorkoutMeasurement,
  ResolvedTargetActivity,
  SuggestedActivity,
  TrackingWorkoutCandidate,
  WorkoutMeasurementComparison,
  WorkoutMismatch,
  WorkoutReconciliationApplyResult,
  WorkoutReconciliationAction,
  WorkoutReconciliationDecision,
  WorkoutReconciliationPreview,
  WorkoutReconciliationPreviewItem,
  WorkoutPrivacyUpdate,
  WorkoutPrivacyUpdateResult,
  WorkoutActivitySuggestionInput,
} from "./types";
import { workoutEffortInsight, workoutMetadata } from "../effort";

const MATCH_SCORE_THRESHOLD = 65;
const AMBIGUOUS_SCORE_GAP = 8;
const DUPLICATE_OVERLAP_RATIO = 0.8;
const HEALTH_WORKOUT_PROVIDERS = ["apple_health", "garmin_connect"] as const;

const healthEntrySource = (provider: string): string =>
  provider === "garmin_connect" ? "garmin_connect" : "apple_health";

const KIND_ALIASES: ReadonlyArray<[RegExp, string]> = [
  [/\b(run|running|jog|jogging|5k|10k|marathon|hyrox)\b/, "running"],
  [/\b(walk|walking|stroll)\b/, "walking"],
  [/\b(cycl|cycle|cycling|bike|biking|spinning)\b/, "cycling"],
  [/\b(hike|hiking|trekking)\b/, "hiking"],
  [/\b(swim|swimming|laps)\b/, "swimming"],
  [/\b(surf|surfing)\b/, "surfing"],
  [/\b(skate|skating|rollerblad)\b/, "skating"],
  [/\b(kayak|rowing|row|canoe|paddle)\b/, "kayaking"],
  [
    /\b(gym|strength|crossfit|cross training|hiit|weight|workout|core training|elliptical|stair climbing|mixed cardio)\b/,
    "gym",
  ],
  [/\b(box|boxing|kickboxing|martial arts)\b/, "boxing"],
  [/\b(boulder|bouldering|climb|climbing)\b/, "bouldering"],
  [/\b(yoga|pilates|stretching)\b/, "yoga"],
];

const WORKOUT_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  traditional_strength_training: "Strength training",
  functional_strength_training: "Functional strength training",
  high_intensity_interval_training: "HIIT",
  core_training: "Core training",
  cross_training: "Cross training",
  stair_climbing: "Stair climbing",
  mixed_cardio: "Mixed cardio",
};

const WORKOUT_EMOJIS: Readonly<Record<string, string>> = {
  running: "🏃",
  walking: "🚶",
  cycling: "🚴",
  hiking: "🥾",
  swimming: "🏊",
  surfing: "🏄",
  skating: "🛼",
  kayaking: "🚣",
  gym: "🏋️",
  boxing: "🥊",
  bouldering: "🧗",
  yoga: "🧘",
  other: "🏃",
};

export class WorkoutReconciliationError extends Error {}

function normalizeWords(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalWorkoutKind(value: string): string {
  const normalized = normalizeWords(value);
  for (const [pattern, kind] of KIND_ALIASES) {
    if (pattern.test(normalized)) return kind;
  }
  return normalized || "other";
}

export function canonicalActivityKind(activity: {
  kind: string;
  title: string;
}): string {
  if (activity.kind && activity.kind !== "other") return activity.kind;
  return canonicalWorkoutKind(activity.title);
}

function displayWorkoutName(value: string): string {
  if (WORKOUT_DISPLAY_NAMES[value]) return WORKOUT_DISPLAY_NAMES[value];
  const normalized = value.replace(/_/g, " ").trim();
  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "Workout";
}

function validTimezone(value: string | null | undefined): string {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

function localDate(date: Date, timezone: string | null | undefined): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizedMeasure(measure: string): string {
  return normalizeWords(measure).replace(/s$/, "");
}

export function healthMeasurementForMeasure(
  workout: Pick<HealthWorkout, "distanceMeters" | "durationSeconds">,
  measure: string,
): NormalizedWorkoutMeasurement | null {
  const normalized = normalizedMeasure(measure);

  if (
    normalized === "kilometer" ||
    normalized === "kilometre" ||
    normalized === "km"
  ) {
    return workout.distanceMeters == null
      ? null
      : {
          value: workout.distanceMeters / 1000,
          unit: "km",
          baseValue: workout.distanceMeters,
          baseUnit: "meters",
        };
  }

  if (normalized === "mile" || normalized === "mi") {
    return workout.distanceMeters == null
      ? null
      : {
          value: workout.distanceMeters / 1609.344,
          unit: "mi",
          baseValue: workout.distanceMeters,
          baseUnit: "meters",
        };
  }

  if (normalized === "meter" || normalized === "metre" || normalized === "m") {
    return workout.distanceMeters == null
      ? null
      : {
          value: workout.distanceMeters,
          unit: "m",
          baseValue: workout.distanceMeters,
          baseUnit: "meters",
        };
  }

  if (normalized === "minute" || normalized === "min") {
    return {
      value: workout.durationSeconds / 60,
      unit: "min",
      baseValue: workout.durationSeconds,
      baseUnit: "seconds",
    };
  }

  if (normalized === "hour" || normalized === "hr") {
    return {
      value: workout.durationSeconds / 3600,
      unit: "hr",
      baseValue: workout.durationSeconds,
      baseUnit: "seconds",
    };
  }

  if (normalized === "second" || normalized === "sec") {
    return {
      value: workout.durationSeconds,
      unit: "sec",
      baseValue: workout.durationSeconds,
      baseUnit: "seconds",
    };
  }

  if (
    normalized === "session" ||
    normalized === "time" ||
    normalized === "workout"
  ) {
    return {
      value: 1,
      unit: "session",
      baseValue: 1,
      baseUnit: "sessions",
    };
  }

  return null;
}

function trackingBaseValue(
  quantity: number,
  measure: string,
  baseUnit: NormalizedWorkoutMeasurement["baseUnit"],
): number | null {
  const normalized = normalizedMeasure(measure);
  if (baseUnit === "meters") {
    if (
      normalized === "kilometer" ||
      normalized === "kilometre" ||
      normalized === "km"
    ) {
      return quantity * 1000;
    }
    if (normalized === "mile" || normalized === "mi") {
      return quantity * 1609.344;
    }
    if (
      normalized === "meter" ||
      normalized === "metre" ||
      normalized === "m"
    ) {
      return quantity;
    }
  }
  if (baseUnit === "seconds") {
    if (normalized === "minute" || normalized === "min") return quantity * 60;
    if (normalized === "hour" || normalized === "hr") return quantity * 3600;
    if (normalized === "second" || normalized === "sec") return quantity;
  }
  if (
    baseUnit === "sessions" &&
    (normalized === "session" ||
      normalized === "time" ||
      normalized === "workout")
  ) {
    return quantity;
  }
  return null;
}

export function compareWorkoutMeasurement(
  workout: Pick<HealthWorkout, "distanceMeters" | "durationSeconds">,
  quantity: number,
  measure: string,
): WorkoutMeasurementComparison {
  const healthMeasurement = healthMeasurementForMeasure(workout, measure);
  if (!healthMeasurement) {
    return {
      compatible: false,
      healthValue: null,
      healthUnit: null,
      trackingValue: quantity,
      trackingUnit: measure,
      differencePercent: null,
      withinTolerance: null,
    };
  }

  const trackingBase = trackingBaseValue(
    quantity,
    measure,
    healthMeasurement.baseUnit,
  );
  if (trackingBase == null) {
    return {
      compatible: false,
      healthValue: null,
      healthUnit: null,
      trackingValue: quantity,
      trackingUnit: measure,
      differencePercent: null,
      withinTolerance: null,
    };
  }

  const absoluteDifference = Math.abs(
    trackingBase - healthMeasurement.baseValue,
  );
  const tolerance =
    healthMeasurement.baseUnit === "meters"
      ? Math.max(100, healthMeasurement.baseValue * 0.05)
      : healthMeasurement.baseUnit === "seconds"
        ? Math.max(180, healthMeasurement.baseValue * 0.1)
        : 0;
  const denominator = Math.max(
    Math.abs(trackingBase),
    Math.abs(healthMeasurement.baseValue),
    1,
  );

  return {
    compatible: true,
    healthValue: healthMeasurement.value,
    healthUnit: healthMeasurement.unit,
    trackingValue: quantity,
    trackingUnit: measure,
    differencePercent: (absoluteDifference / denominator) * 100,
    withinTolerance: absoluteDifference <= tolerance,
  };
}

function isSemanticMatch(
  workout: Pick<HealthWorkout, "activityTypeName">,
  activity: Pick<Activity, "kind" | "title">,
): boolean {
  const workoutKind = canonicalWorkoutKind(workout.activityTypeName);
  const activityKind = canonicalActivityKind(activity);
  if (workoutKind === activityKind) return true;

  const workoutWords = normalizeWords(workout.activityTypeName);
  const activityWords = normalizeWords(activity.title);
  return (
    workoutWords.length > 2 &&
    activityWords.length > 2 &&
    (workoutWords.includes(activityWords) ||
      activityWords.includes(workoutWords))
  );
}

function candidateForEntry(
  workout: HealthWorkout,
  entry: ActivityEntry & { activity: Activity | null },
  rememberedActivityId?: string,
): TrackingWorkoutCandidate | null {
  if (
    !entry.activity ||
    entry.activity.deletedAt ||
    (entry.activity.id !== rememberedActivityId &&
      !isSemanticMatch(workout, entry.activity))
  )
    return null;

  const timezone = workout.timezone ?? entry.timezone;
  if (
    localDate(entry.datetime, timezone) !== localDate(workout.startAt, timezone)
  ) {
    return null;
  }

  const startDifference = Math.abs(
    entry.datetime.getTime() - workout.startAt.getTime(),
  );
  const endDifference = Math.abs(
    entry.datetime.getTime() - workout.endAt.getTime(),
  );
  const timeDifferenceMinutes =
    Math.min(startDifference, endDifference) / 60_000;
  const comparison = compareWorkoutMeasurement(
    workout,
    entry.quantity,
    entry.activity.measure,
  );

  let score = 45;
  if (
    normalizeWords(entry.activity.title) ===
    normalizeWords(workout.activityTypeName)
  ) {
    score += 10;
  }
  if (timeDifferenceMinutes <= 10) score += 40;
  else if (timeDifferenceMinutes <= 60) score += 30;
  else if (timeDifferenceMinutes <= 180) score += 20;
  else score += 12;

  if (comparison.compatible && comparison.withinTolerance) score += 20;
  else if (comparison.compatible) score -= 5;

  return {
    activityEntryId: entry.id,
    activityId: entry.activityId,
    activityTitle: entry.activity.title,
    activityEmoji: entry.activity.emoji,
    activityMeasure: entry.activity.measure,
    quantity: entry.quantity,
    datetime: entry.datetime.toISOString(),
    timezone: entry.timezone,
    distanceMeters: entry.distanceMeters,
    durationSeconds: entry.durationSeconds,
    score: Math.max(0, Math.min(100, score)),
    timeDifferenceMinutes,
    comparison,
  };
}

export function suggestedActivityForWorkout(
  workout: WorkoutActivitySuggestionInput,
  activities: Activity[],
  confirmedMatches: ConfirmedWorkoutActivityMatch[] = [],
): SuggestedActivity | null {
  // Reuse explicit choices, including custom names such as "Morning movement".
  // Only the exact HealthKit workout type learns a preference: yoga must not
  // inherit a Pilates choice just because both share a broad matching category.
  const remembered = confirmedMatches
    .filter((match) => match.activityTypeCode === workout.activityTypeCode)
    .sort(
      (left, right) => right.confirmedAt.getTime() - left.confirmedAt.getTime(),
    )
    .map((match) =>
      activities.find((activity) => activity.id === match.activityId),
    )
    .find(
      (activity) =>
        activity &&
        !activity.deletedAt &&
        healthMeasurementForMeasure(workout, activity.measure) !== null,
    );
  if (remembered) {
    return {
      id: remembered.id,
      title: remembered.title,
      emoji: remembered.emoji,
      measure: remembered.measure,
    };
  }
  const compatible = activities
    .filter(
      (activity) =>
        !activity.deletedAt &&
        isSemanticMatch(workout, activity) &&
        healthMeasurementForMeasure(workout, activity.measure) !== null,
    )
    .sort((left, right) => {
      const leftExact =
        normalizeWords(left.title) === normalizeWords(workout.activityTypeName);
      const rightExact =
        normalizeWords(right.title) ===
        normalizeWords(workout.activityTypeName);
      return Number(rightExact) - Number(leftExact);
    })[0];

  return compatible
    ? {
        id: compatible.id,
        title: compatible.title,
        emoji: compatible.emoji,
        measure: compatible.measure,
      }
    : null;
}

function healthPreview(workout: HealthWorkout): HealthWorkoutPreview {
  const effort = workoutEffortInsight(workout.metadata);
  const metadata = workoutMetadata(workout.metadata);
  return {
    id: workout.id,
    provider: workout.provider,
    activityTypeName: workout.activityTypeName,
    displayName: displayWorkoutName(workout.activityTypeName),
    startAt: workout.startAt.toISOString(),
    endAt: workout.endAt.toISOString(),
    durationSeconds: workout.durationSeconds,
    distanceMeters: workout.distanceMeters,
    activeEnergyKcal: workout.activeEnergyKcal,
    elevationAscendedMeters: metadata.elevationAscendedMeters ?? null,
    elevationDescendedMeters: metadata.elevationDescendedMeters ?? null,
    effortScore: effort?.score ?? null,
    effortSource: effort?.source ?? null,
    difficulty: effort?.difficulty ?? null,
    averageHeartRateBpm: metadata.averageHeartRateBpm ?? null,
    maximumHeartRateBpm: metadata.maximumHeartRateBpm ?? null,
    heartRateZones: metadata.heartRateZones ?? null,
    heartRateSeries: metadata.heartRateSeries ?? null,
    distanceTimeSeries: metadata.distanceTimeSeries ?? null,
    elevationProfile: metadata.elevationProfile ?? null,
    route: metadata.route ?? null,
    sourceName: workout.sourceName,
    deviceName: workout.deviceName,
    timezone: workout.timezone,
  };
}

function overlappingWorkoutIds(workouts: HealthWorkout[]): Map<string, string> {
  const duplicates = new Map<string, string>();
  const sorted = [...workouts].sort(
    (left, right) => left.startAt.getTime() - right.startAt.getTime(),
  );

  for (let index = 0; index < sorted.length; index += 1) {
    const left = sorted[index];
    for (
      let otherIndex = index + 1;
      otherIndex < sorted.length;
      otherIndex += 1
    ) {
      const right = sorted[otherIndex];
      if (right.startAt.getTime() >= left.endAt.getTime()) break;
      if (
        canonicalWorkoutKind(left.activityTypeName) !==
        canonicalWorkoutKind(right.activityTypeName)
      ) {
        continue;
      }

      const overlap =
        Math.min(left.endAt.getTime(), right.endAt.getTime()) -
        Math.max(left.startAt.getTime(), right.startAt.getTime());
      const shorterDuration = Math.min(
        left.endAt.getTime() - left.startAt.getTime(),
        right.endAt.getTime() - right.startAt.getTime(),
      );
      if (
        shorterDuration > 0 &&
        overlap / shorterDuration >= DUPLICATE_OVERLAP_RATIO
      ) {
        duplicates.set(left.id, right.id);
        duplicates.set(right.id, left.id);
      }
    }
  }

  return duplicates;
}

function classificationForWorkout(
  workout: HealthWorkout & {
    reconciliation: {
      action: string;
      activityEntryId: string | null;
      matchReasons: Prisma.JsonValue | null;
      confirmedAt: Date;
      activityEntry: {
        quantity: number;
        activity: Activity | null;
      } | null;
    } | null;
  },
  entries: Array<ActivityEntry & { activity: Activity | null }>,
  activities: Activity[],
  duplicateId: string | undefined,
  confirmedMatches: ConfirmedWorkoutActivityMatch[] = [],
  shareHealthDataByDefault = false,
): WorkoutReconciliationPreviewItem {
  const suggestedActivity = suggestedActivityForWorkout(
    workout,
    activities,
    confirmedMatches,
  );
  const rememberedActivityId = confirmedMatches.some(
    (match) =>
      match.activityTypeCode === workout.activityTypeCode &&
      match.activityId === suggestedActivity?.id,
  )
    ? suggestedActivity?.id
    : undefined;
  const candidates = entries
    .map((entry) => candidateForEntry(workout, entry, rememberedActivityId))
    .filter((candidate): candidate is TrackingWorkoutCandidate =>
      Boolean(candidate),
    )
    .sort((left, right) => right.score - left.score);
  const topCandidate = candidates[0];
  const mismatches: WorkoutMismatch[] = [];

  if (workout.reconciliation) {
    return {
      healthWorkout: healthPreview(workout),
      category: "resolved",
      confidence: 1,
      mismatches,
      candidates,
      suggestedActivity,
      recommendedAction: null,
      resolved: {
        action: workout.reconciliation.action as WorkoutReconciliationAction,
        activityEntryId: workout.reconciliation.activityEntryId,
        healthDataIsPublic:
          !!workout.reconciliation.matchReasons &&
          typeof workout.reconciliation.matchReasons === "object" &&
          !Array.isArray(workout.reconciliation.matchReasons) &&
          workout.reconciliation.matchReasons.healthDataIsPublic === true,
        linkedActivity: workout.reconciliation.activityEntry?.activity
          ? {
              title: workout.reconciliation.activityEntry.activity.title,
              emoji: workout.reconciliation.activityEntry.activity.emoji,
              measure: workout.reconciliation.activityEntry.activity.measure,
              quantity: workout.reconciliation.activityEntry.quantity,
            }
          : null,
        confirmedAt: workout.reconciliation.confirmedAt.toISOString(),
      },
      shareHealthDataByDefault,
    };
  }

  if (duplicateId) {
    mismatches.push({
      code: "possible_duplicate",
      label: "Overlaps another Health workout",
      severity: "conflict",
    });
  }

  if (!topCandidate) {
    return {
      healthWorkout: healthPreview(workout),
      category: duplicateId ? "conflict" : "new",
      confidence: 0,
      mismatches,
      candidates,
      suggestedActivity,
      recommendedAction: duplicateId ? null : "import_new",
      resolved: null,
      shareHealthDataByDefault,
    };
  }

  const secondCandidate = candidates[1];
  const ambiguous = Boolean(
    secondCandidate &&
      secondCandidate.score >= MATCH_SCORE_THRESHOLD &&
      topCandidate.score - secondCandidate.score <= AMBIGUOUS_SCORE_GAP,
  );
  if (ambiguous) {
    mismatches.push({
      code: "ambiguous_match",
      label: "More than one tracking.so log could match",
      severity: "conflict",
    });
  }

  if (!topCandidate.comparison.compatible) {
    mismatches.push({
      code: "unit_incompatible",
      label: `${topCandidate.activityMeasure} cannot be compared with this workout`,
      severity: "warning",
    });
  } else if (!topCandidate.comparison.withinTolerance) {
    mismatches.push({
      code: "value_mismatch",
      label: "Health and tracking.so values differ",
      severity: "conflict",
    });
  } else if ((topCandidate.comparison.differencePercent ?? 0) > 0.01) {
    mismatches.push({
      code: "rounded_value",
      label: "Values match within normal rounding",
      severity: "info",
    });
  }

  const requiresReview =
    Boolean(duplicateId) ||
    ambiguous ||
    topCandidate.score < MATCH_SCORE_THRESHOLD ||
    !topCandidate.comparison.compatible ||
    topCandidate.comparison.withinTolerance === false;

  return {
    healthWorkout: healthPreview(workout),
    category: requiresReview ? "conflict" : "match",
    confidence: topCandidate.score / 100,
    mismatches,
    candidates,
    suggestedActivity,
    recommendedAction: requiresReview ? null : "link_keep",
    resolved: null,
    shareHealthDataByDefault,
  };
}

export async function getWorkoutReconciliationPreview(
  userId: string,
): Promise<WorkoutReconciliationPreview> {
  const workouts = await prisma.healthWorkout.findMany({
    where: {
      userId,
      provider: { in: [...HEALTH_WORKOUT_PROVIDERS] },
      deletedAt: null,
    },
    include: {
      reconciliation: {
        select: {
          action: true,
          activityEntryId: true,
          matchReasons: true,
          confirmedAt: true,
          activityEntry: {
            select: {
              activityId: true,
              userId: true,
              deletedAt: true,
              quantity: true,
              activity: true,
            },
          },
        },
      },
    },
    orderBy: { startAt: "desc" },
  });
  if (workouts.length === 0) {
    return {
      summary: {
        total: 0,
        pending: 0,
        matches: 0,
        newWorkouts: 0,
        conflicts: 0,
        resolved: 0,
      },
      items: [],
    };
  }

  const earliestWorkout = workouts.at(-1)!.startAt.getTime();
  const latestWorkout = workouts[0].endAt.getTime();
  const candidateWindowStart = new Date(earliestWorkout - 24 * 60 * 60 * 1000);
  const candidateWindowEnd = new Date(latestWorkout + 24 * 60 * 60 * 1000);
  const [user, activities, entries] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { healthWorkoutDataIsPublicByDefault: true },
    }),
    prisma.activity.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activityEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        datetime: { gte: candidateWindowStart, lte: candidateWindowEnd },
      },
      include: { activity: true },
      orderBy: { datetime: "desc" },
    }),
  ]);
  const duplicateIds = overlappingWorkoutIds(workouts);
  const confirmedMatches: ConfirmedWorkoutActivityMatch[] = workouts.flatMap(
    (workout) => {
      const saved = workout.reconciliation;
      const entry = saved?.activityEntry;
      if (
        !saved ||
        !["link_keep", "link_use_health", "import_new"].includes(
          saved.action,
        ) ||
        !entry?.activityId ||
        entry.userId !== userId ||
        entry.deletedAt
      )
        return [];
      return [
        {
          activityTypeCode: workout.activityTypeCode,
          activityId: entry.activityId,
          confirmedAt: saved.confirmedAt,
        },
      ];
    },
  );
  const items = workouts.map((workout) =>
    classificationForWorkout(
      workout,
      entries,
      activities,
      duplicateIds.get(workout.id),
      confirmedMatches,
      user?.healthWorkoutDataIsPublicByDefault ?? false,
    ),
  );

  return {
    summary: {
      total: items.length,
      pending: items.filter((item) => item.category !== "resolved").length,
      matches: items.filter((item) => item.category === "match").length,
      newWorkouts: items.filter((item) => item.category === "new").length,
      conflicts: items.filter((item) => item.category === "conflict").length,
      resolved: items.filter((item) => item.category === "resolved").length,
    },
    items,
  };
}

function quantityFromWorkout(
  workout: Pick<HealthWorkout, "distanceMeters" | "durationSeconds">,
  measure: string,
): number | null {
  const measurement = healthMeasurementForMeasure(workout, measure);
  return measurement ? Math.max(1, Math.round(measurement.value)) : null;
}

function newActivityDefaults(workout: HealthWorkout): {
  title: string;
  measure: string;
  emoji: string;
  kind: string;
} {
  const kind = canonicalWorkoutKind(workout.activityTypeName);
  return {
    title: displayWorkoutName(workout.activityTypeName),
    measure: workout.distanceMeters != null ? "kilometers" : "minutes",
    emoji: WORKOUT_EMOJIS[kind] ?? WORKOUT_EMOJIS.other,
    kind: [
      "running",
      "walking",
      "cycling",
      "hiking",
      "swimming",
      "surfing",
      "skating",
      "kayaking",
      "gym",
      "boxing",
      "bouldering",
      "yoga",
    ].includes(kind)
      ? kind
      : "other",
  };
}

async function resolveTargetActivity(
  transaction: Prisma.TransactionClient,
  userId: string,
  workout: HealthWorkout,
  requestedActivityId: string | undefined,
  suggestedActivityId: string | undefined,
  newActivity: WorkoutReconciliationDecision["newActivity"],
): Promise<ResolvedTargetActivity> {
  const activityId = newActivity
    ? undefined
    : (requestedActivityId ?? suggestedActivityId);
  if (activityId) {
    const activity = await transaction.activity.findFirst({
      where: { id: activityId, userId, deletedAt: null },
    });
    if (!activity) {
      throw new WorkoutReconciliationError("Selected activity was not found");
    }
    if (healthMeasurementForMeasure(workout, activity.measure)) {
      return { activity, created: false };
    }
    throw new WorkoutReconciliationError(
      "This activity's measurement cannot be filled from the workout. Choose another activity.",
    );
  }

  const defaults = { ...newActivityDefaults(workout), ...newActivity };
  if (!healthMeasurementForMeasure(workout, defaults.measure))
    throw new WorkoutReconciliationError(
      "This workout has no compatible measurement.",
    );
  const existing = await transaction.activity.findFirst({
    where: {
      userId,
      deletedAt: null,
      title: { equals: defaults.title, mode: "insensitive" },
      measure: defaults.measure,
    },
  });
  if (existing) return { activity: existing, created: false };

  const activity = await transaction.activity.create({
    data: { userId, ...defaults },
  });
  return { activity, created: true };
}

function matchReasons(
  previewItem: WorkoutReconciliationPreviewItem | undefined,
  healthDataIsPublic: boolean,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify({
      category: previewItem?.category ?? "unknown",
      confidence: previewItem?.confidence ?? 0,
      mismatches: previewItem?.mismatches ?? [],
      healthDataIsPublic,
    }),
  ) as Prisma.InputJsonValue;
}

export async function applyWorkoutReconciliations(
  userId: string,
  decisions: WorkoutReconciliationDecision[],
): Promise<WorkoutReconciliationApplyResult> {
  const preview = await getWorkoutReconciliationPreview(userId);
  const previewById = new Map(
    preview.items.map((item) => [item.healthWorkout.id, item]),
  );

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext('health-reconcile'))`;
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { healthWorkoutDataIsPublicByDefault: true },
    });
    const shareHealthDataByDefault =
      user?.healthWorkoutDataIsPublicByDefault ?? false;
    const result: WorkoutReconciliationApplyResult = {
      linked: 0,
      imported: 0,
      ignored: 0,
      alreadyResolved: 0,
    };

    for (const decision of decisions) {
      const workout = await transaction.healthWorkout.findFirst({
        where: {
          id: decision.healthWorkoutId,
          userId,
          provider: { in: [...HEALTH_WORKOUT_PROVIDERS] },
          deletedAt: null,
        },
        include: { reconciliation: true },
      });
      if (!workout) {
        throw new WorkoutReconciliationError("Health workout was not found");
      }
      if (workout.reconciliation) {
        result.alreadyResolved += 1;
        continue;
      }

      const previewItem = previewById.get(workout.id);
      const workoutDifficulty = workoutEffortInsight(
        workout.metadata,
      )?.difficulty;
      let activityEntryId: string | null = null;
      let createdActivity = false;

      if (decision.action === "ignore") {
        result.ignored += 1;
      } else if (
        decision.action === "link_keep" ||
        decision.action === "link_use_health"
      ) {
        const entry = await transaction.activityEntry.findFirst({
          where: {
            id: decision.activityEntryId,
            userId,
            deletedAt: null,
          },
          include: { activity: true },
        });
        if (!entry || !entry.activity) {
          throw new WorkoutReconciliationError(
            "Selected tracking.so workout was not found",
          );
        }

        const healthQuantity = quantityFromWorkout(
          workout,
          entry.activity.measure,
        );
        if (decision.action === "link_use_health" && healthQuantity == null) {
          throw new WorkoutReconciliationError(
            `${entry.activity.measure} cannot be converted from this Health workout`,
          );
        }

        await transaction.activityEntry.update({
          where: { id: entry.id },
          data: {
            source:
              entry.source === healthEntrySource(workout.provider)
                ? healthEntrySource(workout.provider)
                : `${healthEntrySource(workout.provider)}_linked`,
            ...(entry.difficulty == null && workoutDifficulty
              ? { difficulty: workoutDifficulty }
              : {}),
            ...(decision.action === "link_use_health" && healthQuantity != null
              ? { quantity: healthQuantity }
              : {}),
            startedAt:
              decision.action === "link_use_health" || entry.startedAt == null
                ? workout.startAt
                : entry.startedAt,
            endedAt:
              decision.action === "link_use_health" || entry.endedAt == null
                ? workout.endAt
                : entry.endedAt,
            distanceMeters:
              decision.action === "link_use_health" ||
              entry.distanceMeters == null
                ? workout.distanceMeters
                : entry.distanceMeters,
            durationSeconds:
              decision.action === "link_use_health" ||
              entry.durationSeconds == null
                ? Math.round(workout.durationSeconds)
                : entry.durationSeconds,
          },
        });
        activityEntryId = entry.id;
        result.linked += 1;
      } else {
        const target = await resolveTargetActivity(
          transaction,
          userId,
          workout,
          decision.activityId,
          previewItem?.suggestedActivity?.id,
          decision.newActivity,
        );
        const targetActivity = target.activity;
        createdActivity = target.created;
        const quantity = quantityFromWorkout(workout, targetActivity.measure);
        if (quantity == null) {
          throw new WorkoutReconciliationError(
            `${targetActivity.measure} cannot be converted from this Health workout`,
          );
        }

        const entry = await transaction.activityEntry.create({
          data: {
            userId,
            activityId: targetActivity.id,
            quantity,
            datetime: workout.endAt,
            timezone: workout.timezone,
            source: healthEntrySource(workout.provider),
            startedAt: workout.startAt,
            endedAt: workout.endAt,
            distanceMeters: workout.distanceMeters,
            durationSeconds: Math.round(workout.durationSeconds),
            difficulty: workoutDifficulty,
          },
        });
        activityEntryId = entry.id;
        result.imported += 1;
      }

      await transaction.healthWorkoutReconciliation.create({
        data: {
          userId,
          healthWorkoutId: workout.id,
          activityEntryId,
          action: decision.action,
          createdActivity,
          matchConfidence: previewItem?.confidence,
          matchReasons: matchReasons(
            previewItem,
            decision.action === "ignore"
              ? false
              : (decision.shareHealthData ?? shareHealthDataByDefault),
          ),
        },
      });
    }

    return result;
  });
}

function privacyMatchReasons(
  matchReasons: Prisma.JsonValue | null,
  healthDataIsPublic: boolean,
): Prisma.InputJsonValue {
  const existing =
    matchReasons &&
    typeof matchReasons === "object" &&
    !Array.isArray(matchReasons)
      ? matchReasons
      : {};
  return JSON.parse(
    JSON.stringify({ ...existing, healthDataIsPublic }),
  ) as Prisma.InputJsonValue;
}

export async function updateWorkoutPrivacy(
  userId: string,
  update: WorkoutPrivacyUpdate,
): Promise<WorkoutPrivacyUpdateResult> {
  return prisma.$transaction(async (transaction) => {
    const reconciliation =
      await transaction.healthWorkoutReconciliation.findFirst({
        where: {
          userId,
          healthWorkoutId: update.healthWorkoutId,
          healthWorkout: { userId, deletedAt: null },
        },
        select: {
          id: true,
          action: true,
          activityEntryId: true,
          matchReasons: true,
        },
      });

    if (
      !reconciliation ||
      !reconciliation.activityEntryId ||
      reconciliation.action === "ignore"
    ) {
      throw new WorkoutReconciliationError(
        "Only a linked workout can change Watch data privacy",
      );
    }

    await transaction.healthWorkoutReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        matchReasons: privacyMatchReasons(
          reconciliation.matchReasons,
          update.shareHealthData,
        ),
      },
    });

    if (update.makeDefault) {
      await transaction.user.update({
        where: { id: userId },
        data: {
          healthWorkoutDataIsPublicByDefault: update.shareHealthData,
        },
      });
    }

    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { healthWorkoutDataIsPublicByDefault: true },
    });

    return {
      healthDataIsPublic: update.shareHealthData,
      shareHealthDataByDefault:
        user?.healthWorkoutDataIsPublicByDefault ?? false,
    };
  });
}
