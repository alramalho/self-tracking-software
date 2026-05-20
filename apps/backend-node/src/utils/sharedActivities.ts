import type { ActivityKind } from "../constants/activityCategories";

export interface SharedActivityMatchInput {
  sourceTitle: string;
  sourceMeasure: string;
  sourceEmoji: string;
  sourceDatetime: Date;
  sourceKind?: ActivityKind;
  sourceLatitude?: number | null;
  sourceLongitude?: number | null;
  candidateTitle: string;
  candidateMeasure: string;
  candidateEmoji: string;
  candidateDatetime: Date;
  candidateKind?: ActivityKind;
  candidateLatitude?: number | null;
  candidateLongitude?: number | null;
}

export function normalizeActivityLabel(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasSemanticMatchByTitle(input: SharedActivityMatchInput): boolean {
  const sourceTitle = normalizeActivityLabel(input.sourceTitle);
  const candidateTitle = normalizeActivityLabel(input.candidateTitle);
  return (
    sourceTitle === candidateTitle ||
    (!!sourceTitle &&
      !!candidateTitle &&
      (sourceTitle.includes(candidateTitle) || candidateTitle.includes(sourceTitle))) ||
    (!!input.sourceEmoji && input.sourceEmoji === input.candidateEmoji)
  );
}

function hasSemanticMatch(input: SharedActivityMatchInput): boolean {
  const bothHaveKind =
    input.sourceKind &&
    input.sourceKind !== "other" &&
    input.candidateKind &&
    input.candidateKind !== "other";

  if (bothHaveKind) {
    return input.sourceKind === input.candidateKind;
  }

  return hasSemanticMatchByTitle(input);
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function scoreSharedActivityCandidate(input: SharedActivityMatchInput): number {
  if (!isSameCalendarDay(input.sourceDatetime, input.candidateDatetime)) return 0;
  if (!hasSemanticMatch(input)) return 0;

  const minutesApart = Math.abs(
    input.sourceDatetime.getTime() - input.candidateDatetime.getTime()
  ) / 60000;

  let score = 0;
  if (minutesApart <= 30) score += 50;
  else if (minutesApart <= 90) score += 35;
  else score += 20;

  const sourceTitle = normalizeActivityLabel(input.sourceTitle);
  const candidateTitle = normalizeActivityLabel(input.candidateTitle);
  if (sourceTitle && sourceTitle === candidateTitle) score += 40;
  else if (
    sourceTitle &&
    candidateTitle &&
    (sourceTitle.includes(candidateTitle) || candidateTitle.includes(sourceTitle))
  ) {
    score += 20;
  }

  if (normalizeActivityLabel(input.sourceMeasure) === normalizeActivityLabel(input.candidateMeasure)) {
    score += 10;
  }

  if (input.sourceEmoji && input.sourceEmoji === input.candidateEmoji) {
    score += 10;
  }

  // Kind match bonus
  if (
    input.sourceKind &&
    input.sourceKind !== "other" &&
    input.sourceKind === input.candidateKind
  ) {
    score += 30;
  }

  // Location proximity bonus
  if (
    input.sourceLatitude != null &&
    input.sourceLongitude != null &&
    input.candidateLatitude != null &&
    input.candidateLongitude != null
  ) {
    const km = haversineKm(
      input.sourceLatitude,
      input.sourceLongitude,
      input.candidateLatitude,
      input.candidateLongitude
    );
    if (km <= 1) score += 30;
    else if (km <= 5) score += 15;
  }

  return score;
}

export function isLikelySharedActivity(input: SharedActivityMatchInput): boolean {
  return scoreSharedActivityCandidate(input) >= 50;
}

export function shouldLookupSharedActivityCandidates(withUserId?: string | null): boolean {
  return !withUserId;
}
