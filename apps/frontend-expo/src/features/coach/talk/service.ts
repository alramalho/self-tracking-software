import { api } from "@/data/api";
import type { TalkReason, TalkRequest, TalkTurn } from "./types";

export const nextTurn = async (planId: string, request: TalkRequest) =>
  (await api.post<TalkTurn>(`/follow-through/plans/${encodeURIComponent(planId)}/talk`, request)).data;

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
