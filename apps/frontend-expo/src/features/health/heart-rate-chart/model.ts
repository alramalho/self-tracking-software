import type { HeartRateSeriesPoint, HeartRateZones } from "../workout-types";
import type {
  HeartRateChartModel,
  HeartRateChartPoint,
  HeartRateChartSegment,
  HeartRateZone,
} from "./types";

export const CHART_WIDTH = 320;
export const CHART_HEIGHT = 160;
export const CHART_PADDING = 20;
export const ZONE_BOUNDARIES = [0.6, 0.7, 0.8, 0.9] as const;

export function workoutElapsedSpan(startAt: string, endAt: string): number | null {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  const span = (end - start) / 1000;
  return Number.isFinite(span) && span > 0 ? span : null;
}

export function zoneForBpm(bpm: number, maximum: number): HeartRateZone {
  const percentage = bpm / maximum;
  if (percentage < ZONE_BOUNDARIES[0]) return 1;
  if (percentage < ZONE_BOUNDARIES[1]) return 2;
  if (percentage < ZONE_BOUNDARIES[2]) return 3;
  if (percentage < ZONE_BOUNDARIES[3]) return 4;
  return 5;
}

export function zoneReference(zones: HeartRateZones | null | undefined, age: number | null | undefined) {
  if (
    zones?.source === "age_estimate" &&
    Number.isFinite(zones.estimatedMaxHeartRateBpm) &&
    zones.estimatedMaxHeartRateBpm > 0
  ) {
    return {
      maximumForZones: zones.estimatedMaxHeartRateBpm,
      zoneSource: "workout_age_estimate" as const,
    };
  }
  if (age != null && Number.isInteger(age) && age >= 13 && age <= 100) {
    return {
      maximumForZones: 220 - age,
      zoneSource: "profile_age" as const,
    };
  }
  // A provider's generic 200 bpm fallback is not a personal threshold.
  return { maximumForZones: null, zoneSource: null };
}

export function buildHeartRateChart(
  samples: HeartRateSeriesPoint[] | null | undefined,
  elapsedSpanSeconds: number,
  zones?: HeartRateZones | null,
  age?: number | null,
): HeartRateChartModel | null {
  if (!Number.isFinite(elapsedSpanSeconds) || elapsedSpanSeconds <= 0) return null;
  const valid = (samples ?? [])
    .filter(
      (sample) =>
        Number.isFinite(sample.elapsedSeconds) &&
        sample.elapsedSeconds >= 0 &&
        sample.elapsedSeconds <= elapsedSpanSeconds &&
        Number.isFinite(sample.bpm) &&
        sample.bpm > 0 &&
        sample.bpm <= 300,
    )
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds)
    .filter((sample, index, array) => index === 0 || sample.elapsedSeconds !== array[index - 1].elapsedSeconds);
  if (valid.length < 2) return null;

  const bpmValues = valid.map((sample) => sample.bpm);
  const minimumBpm = Math.floor(Math.min(...bpmValues) / 10) * 10;
  const maximumBpm = Math.ceil(Math.max(...bpmValues) / 10) * 10;
  const bpmRange = Math.max(20, maximumBpm - minimumBpm);
  const chartMaximum = minimumBpm + bpmRange;
  const { maximumForZones, zoneSource } = zoneReference(zones, age);
  const points = valid.map((sample) => ({
    ...sample,
    x: CHART_PADDING + (sample.elapsedSeconds / elapsedSpanSeconds) * (CHART_WIDTH - 2 * CHART_PADDING),
    y: CHART_HEIGHT - CHART_PADDING - ((sample.bpm - minimumBpm) / bpmRange) * (CHART_HEIGHT - 2 * CHART_PADDING),
  }));
  const intervals = valid.slice(1).map((sample, index) => sample.elapsedSeconds - valid[index].elapsedSeconds);
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
  // Sparse or missing periods should remain visible rather than forming a long slope.
  const maximumConnectedGap = Math.min(180, Math.max(90, medianInterval * 3));
  const segments: HeartRateChartSegment[] = [];
  let hasGaps = false;

  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    if (to.elapsedSeconds - from.elapsedSeconds > maximumConnectedGap) {
      hasGaps = true;
      continue;
    }
    if (maximumForZones == null || from.bpm === to.bpm) {
      segments.push({ from, to, zone: maximumForZones == null ? null : zoneForBpm(from.bpm, maximumForZones) });
      continue;
    }
    const transitions: HeartRateChartPoint[] = [from];
    for (const percentage of ZONE_BOUNDARIES) {
      const threshold = percentage * maximumForZones;
      if (threshold <= Math.min(from.bpm, to.bpm) || threshold >= Math.max(from.bpm, to.bpm)) continue;
      const ratio = (threshold - from.bpm) / (to.bpm - from.bpm);
      transitions.push({
        elapsedSeconds: from.elapsedSeconds + ratio * (to.elapsedSeconds - from.elapsedSeconds),
        bpm: threshold,
        x: from.x + ratio * (to.x - from.x),
        y: from.y + ratio * (to.y - from.y),
      });
    }
    transitions.push(to);
    transitions.sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
    for (let step = 1; step < transitions.length; step++) {
      const start = transitions[step - 1];
      const end = transitions[step];
      segments.push({ from: start, to: end, zone: zoneForBpm((start.bpm + end.bpm) / 2, maximumForZones) });
    }
  }
  return {
    points,
    segments,
    minimumBpm,
    maximumBpm: chartMaximum,
    elapsedSpanSeconds,
    maximumForZones,
    zoneSource,
    hasGaps,
  };
}
