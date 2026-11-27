import type { AxiosInstance } from "axios";
import type { TalkLogDraft, TalkReason, TalkRequest, TalkTurn } from "./types";

// Same calls and opening questions as the iPhone app (features/coach/talk/service.ts).
export const nextTurn = async (api: AxiosInstance, planId: string, request: TalkRequest) =>
  (await api.post<TalkTurn>(`/follow-through/plans/${encodeURIComponent(planId)}/talk`, request)).data;

/** "Pause until …": the plan pauses through that day and picks up again by itself. */
export const pausePlan = async (api: AxiosInstance, planId: string, until: string) =>
  (await api.post<{ until: string; backOn: string }>(`/follow-through/plans/${encodeURIComponent(planId)}/pause`, { until })).data;

/** "Log it" on the coach's card: saved like a voice note, and the plan's alert is answered. */
export async function saveLogDraft(api: AxiosInstance, planId: string, draft: TalkLogDraft) {
  await api.post("/voice-logs/commit", {
    clientRequestId: draft.clientRequestId,
    transcript: draft.transcript,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    activities: draft.activities.map(({ confidence: _c, title: _t, emoji: _e, measure: _m, ...activity }) => activity),
    metrics: [],
    note: draft.note,
  });
  await api.post(`/follow-through/plans/${encodeURIComponent(planId)}/caught-up`, {});
}

/** "Mon 30 Nov" for a yyyy-MM-dd day. */
export const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/** "Keep nudging me". */
export const endQuiet = (api: AxiosInstance, planId: string) =>
  api.delete(`/follow-through/plans/${encodeURIComponent(planId)}/quiet`);

/** "Something else" and "Talk to …" start with the person's words, so their first screen needs no call. */
export const openingQuestion = (reason: TalkReason): TalkTurn | null =>
  reason === "other" || reason === "talk"
    ? {
        say: reason === "other" ? "What got in the way?" : "What's on your mind?",
        detail: "",
        ask: "text",
        placeholder: reason === "other" ? "In a sentence" : "In your own words",
        quietUntil: null,
      }
    : null;

export const TALK_REASONS: TalkReason[] = ["busy", "sick", "travel", "motivation", "other", "talk"];
