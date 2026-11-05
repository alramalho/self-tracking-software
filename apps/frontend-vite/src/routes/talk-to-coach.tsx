import { createFileRoute } from "@tanstack/react-router";
import { TalkToCoach } from "@/components/coach/talk/TalkToCoach";
import { TALK_REASONS } from "@/components/coach/talk/service";
import type { TalkReason, TalkToCoachSearch } from "@/components/coach/talk/types";

export const Route = createFileRoute("/talk-to-coach")({
  component: TalkToCoachPage,
  validateSearch: (search: Record<string, unknown>): TalkToCoachSearch => ({
    planId: typeof search.planId === "string" ? search.planId : "",
    reason: TALK_REASONS.includes(search.reason as TalkReason) ? (search.reason as TalkReason) : "talk",
  }),
});

function TalkToCoachPage() {
  const search = Route.useSearch();
  return <TalkToCoach {...search} />;
}
