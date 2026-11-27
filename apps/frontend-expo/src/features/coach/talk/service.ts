import { api } from "@/data/api";
import type { TalkReason, TalkRequest, TalkTurn } from "./types";

export const nextTurn = async (planId: string, request: TalkRequest) =>
  (await api.post<TalkTurn>(`/follow-through/plans/${encodeURIComponent(planId)}/talk`, request)).data;

/** "Pause until …": the plan pauses through that day and picks up again by itself. */
export const pausePlan = async (planId: string, until: string) =>
  (await api.post<{ until: string; backOn: string }>(`/follow-through/plans/${encodeURIComponent(planId)}/pause`, { until })).data;

/** "Mon 30 Nov" for a yyyy-MM-dd day. */
export const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/** "Keep nudging me". */
export const endQuiet = async (planId: string) =>
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
