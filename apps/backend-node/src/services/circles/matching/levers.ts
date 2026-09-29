import { LEVER_WEIGHTS, REASON_MIN } from "../config";
import type { MatchProfile, PairScore, Reason } from "../types";

// Raw cosine similarity of two plan embeddings, squashed so 0.5 stays 0.5 and
// clearly similar goals rise fast (same curve the partner recommendations used).
export function goalLever(cosine: number): number {
  return 1 / (1 + Math.exp(-10 * (cosine - 0.5)));
}

// Similar weekly targets, and people who actually show up with people who do too.
export function paceLever(a: MatchProfile, b: MatchProfile): number {
  const high = Math.max(a.weeklyTarget, b.weeklyTarget, 1);
  const targets = 1 - Math.abs(a.weeklyTarget - b.weeklyTarget) / high;
  const showingUp =
    a.completionRate === null || b.completionRate === null
      ? 1
      : 1 - Math.abs(a.completionRate - b.completionRate);
  return 0.6 * targets + 0.4 * showingUp;
}

export function distanceKm(a: MatchProfile, b: MatchProfile): number | null {
  if (a.latitude === null || a.longitude === null) return null;
  if (b.latitude === null || b.longitude === null) return null;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function timezoneLever(a: string | null, b: string | null): number {
  if (!a || !b) return 0.5;
  if (a === b) return 1;
  return a.split("/")[0] === b.split("/")[0] ? 0.8 : 0.3;
}

// With "Nearby" it is real distance (full marks under 15 km, none past 300 km);
// otherwise weeks line up best in similar time zones.
export function placeLever(
  from: MatchProfile,
  to: MatchProfile,
): { value: number; sameCity: boolean } {
  const km = from.preferences.wantsNearby ? distanceKm(from, to) : null;
  if (km === null) return { value: timezoneLever(from.timezone, to.timezone), sameCity: false };
  const value = km <= 15 ? 1 : km >= 300 ? 0 : 1 - (km - 15) / 285;
  return { value, sameCity: km <= 15 };
}

export function ageLever(a: number | null, b: number | null): number {
  if (!a || !b) return 0.5;
  return Math.exp(-2 * Math.log(a / b) ** 2);
}

// How well `to` fits what `from` asked for. Levers `from` didn't pick are left out
// and the remaining weights are scaled back up to 1.
export function pairScore(
  from: MatchProfile,
  to: MatchProfile,
  goalCosine: number,
): PairScore {
  const levers: PairScore["levers"] = {
    goal: goalLever(goalCosine),
    place: placeLever(from, to).value,
  };
  if (from.preferences.wantsPace) levers.pace = paceLever(from, to);
  if (from.preferences.wantsAge) levers.age = ageLever(from.age, to.age);
  let weight = 0;
  let total = 0;
  for (const [lever, value] of Object.entries(levers)) {
    const w = LEVER_WEIGHTS[lever as keyof typeof LEVER_WEIGHTS];
    weight += w;
    total += w * (value ?? 0);
  }
  return { score: weight ? total / weight : 0, levers };
}

// Both people must be happy with the match, so a pair is only as good as its weaker side.
export function mutualScore(
  a: MatchProfile,
  b: MatchProfile,
  goalCosine: number,
): number {
  return Math.min(
    pairScore(a, b, goalCosine).score,
    pairScore(b, a, goalCosine).score,
  );
}

// A newcomer's fit with a circle is their average mutual score with its members.
export function circleScore(
  candidate: MatchProfile,
  members: MatchProfile[],
  goalCosineByPlan: Map<string, number>,
): number {
  if (!members.length) return 0;
  const scores = members.map((m) =>
    mutualScore(candidate, m, goalCosineByPlan.get(m.planId) ?? 0),
  );
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

// Chips that are true for everyone in the circle: we never claim a reason that
// only fits some of them.
export function matchReasons(
  candidate: MatchProfile,
  members: MatchProfile[],
  goalCosineByPlan: Map<string, number>,
): Reason[] {
  if (!members.length) return [];
  const all = (test: (m: MatchProfile) => boolean) => members.every(test);
  const reasons: Reason[] = [];
  if (all((m) => goalLever(goalCosineByPlan.get(m.planId) ?? 0) >= REASON_MIN))
    reasons.push("goal");
  if (all((m) => paceLever(candidate, m) >= REASON_MIN)) reasons.push("pace");
  if (
    candidate.preferences.wantsNearby &&
    all((m) => placeLever(candidate, m).sameCity)
  )
    reasons.push("sameCity");
  else if (all((m) => timezoneLever(candidate.timezone, m.timezone) >= 0.8))
    reasons.push("timezone");
  if (
    candidate.age &&
    all((m) => !!m.age && ageLever(candidate.age, m.age) >= REASON_MIN)
  )
    reasons.push("age");
  return reasons;
}
