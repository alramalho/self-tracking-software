import type { AxiosInstance } from "axios";
import type { TalkReason, TalkRequest, TalkTurn } from "./types";

// Same calls and opening questions as the iPhone app (features/coach/talk/service.ts).
export const nextTurn = async (api: AxiosInstance, planId: string, request: TalkRequest) =>
  (await api.post<TalkTurn>(`/follow-through/plans/${encodeURIComponent(planId)}/talk`, request)).data;

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
