import type { ActivityEntry } from "@/core/types";

const HEALTH_SOURCES = new Set([
  "apple_health",
  "apple_health_linked",
  "garmin_connect",
  "garmin_connect_linked",
]);

function normalizedMeasure(measure: string | undefined): string {
  return (measure ?? "").trim().toLowerCase().replace(/s$/, "");
}

function oneDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

export function isAppleHealthEntry(entry: ActivityEntry | undefined): boolean {
  return !!entry?.source && HEALTH_SOURCES.has(entry.source);
}

export function activityEntryMeasurement(
  entry: ActivityEntry | undefined,
  measure: string | undefined,
): string {
  if (!entry) return "";

  const normalized = normalizedMeasure(measure);
  if (isAppleHealthEntry(entry)) {
    if (
      entry.distanceMeters != null &&
      ["kilometer", "kilometre", "km"].includes(normalized)
    ) {
      return `${oneDecimal(entry.distanceMeters / 1000)} km`;
    }
    if (entry.distanceMeters != null && ["mile", "mi"].includes(normalized)) {
      return `${oneDecimal(entry.distanceMeters / 1609.344)} mi`;
    }
    if (
      entry.distanceMeters != null &&
      ["meter", "metre", "m"].includes(normalized)
    ) {
      return `${Math.round(entry.distanceMeters)} m`;
    }
    if (
      entry.durationSeconds != null &&
      ["minute", "min"].includes(normalized)
    ) {
      return `${Math.max(1, Math.round(entry.durationSeconds / 60))} min`;
    }
    if (entry.durationSeconds != null && ["hour", "hr"].includes(normalized)) {
      return `${oneDecimal(entry.durationSeconds / 3600)} hr`;
    }
    if (
      entry.durationSeconds != null &&
      ["second", "sec"].includes(normalized)
    ) {
      return `${Math.round(entry.durationSeconds)} sec`;
    }
  }

  return `${entry.quantity} ${measure ?? ""}`.trim();
}

export function appleHealthDuration(
  entry: ActivityEntry | undefined,
  measure: string | undefined,
): string | null {
  if (!isAppleHealthEntry(entry) || entry?.durationSeconds == null) return null;
  if (
    ["minute", "min", "hour", "hr", "second", "sec"].includes(
      normalizedMeasure(measure),
    )
  ) {
    return null;
  }
  return `${Math.max(1, Math.round(entry.durationSeconds / 60))} min`;
}
