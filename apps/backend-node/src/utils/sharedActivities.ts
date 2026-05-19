import type { ActivityKind } from "../constants/activityCategories";

export interface SharedActivityMatchInput {
  sourceTitle: string;
  sourceMeasure: string;
  sourceEmoji: string;
  sourceDatetime: Date;
  sourceKind?: ActivityKind;
  candidateTitle: string;
  candidateMeasure: string;
  candidateEmoji: string;
  candidateDatetime: Date;
  candidateKind?: ActivityKind;
}

export function normalizeActivityLabel(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export function scoreSharedActivityCandidate(input: SharedActivityMatchInput): number {
  const minutesApart = Math.abs(
    input.sourceDatetime.getTime() - input.candidateDatetime.getTime()
  ) / 60000;

  if (minutesApart > 180) return 0;
  if (!hasSemanticMatch(input)) return 0;

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

  return score;
}

export function isLikelySharedActivity(input: SharedActivityMatchInput): boolean {
  return scoreSharedActivityCandidate(input) >= 50;
}

export function shouldLookupSharedActivityCandidates(withUserId?: string | null): boolean {
  return !withUserId;
}
