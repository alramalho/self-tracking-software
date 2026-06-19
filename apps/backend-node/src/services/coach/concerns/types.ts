export const CONCERN_RESOLVED_REASON = {
  USER_ACTED: "user_acted",
  USER_DISMISSED: "user_dismissed",
  AUTO_ARCHIVE: "auto_archive",
  STALE: "stale",
} as const;

export type ConcernResolvedReason =
  (typeof CONCERN_RESOLVED_REASON)[keyof typeof CONCERN_RESOLVED_REASON];

export interface ConcernObservation {
  userId: string;
  planId?: string | null;
  kind: string;
  severity?: number;
  data?: Record<string, unknown> | null;
}

export function concernDedupeKey(kind: string, planId?: string | null): string {
  return `${kind}:${planId ?? "_"}`;
}
