import { coachConcernService } from "./service";
import { detectConcernsForUser, type DetectorUser } from "./detectors";
import { concernDedupeKey } from "./types";

export interface DetectionResult {
  observed: number;
  resolvedStale: number;
}

// One detection tick: refresh the ledger to mirror reality as-of `now`. Observes
// every currently-true concern and resolves any live concern that no longer holds.
// No raising / messaging happens here — that is the reconciler's job.
export async function runConcernDetection(
  user: DetectorUser,
  now: Date
): Promise<DetectionResult> {
  const observations = await detectConcernsForUser(user, now);

  for (const observation of observations) {
    await coachConcernService.observe(observation, now);
  }

  const observedKeys = new Set(
    observations.map((observation) =>
      concernDedupeKey(observation.kind, observation.planId)
    )
  );
  const resolvedStale = await coachConcernService.resolveMissing(
    user.id,
    observedKeys,
    now
  );

  return { observed: observations.length, resolvedStale };
}
