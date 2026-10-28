import type { CircleCard } from "@/components/circles/types";
import type { ExplorePerson } from "./types";

// "🏃 Run a half marathon", or their username when no plan is shared.
export const planLine = (person: ExplorePerson) =>
  person.plan ? [person.plan.emoji, person.plan.goal].filter(Boolean).join(" ") : `@${person.username}`;

// "Lisbon · 3–4 a week"
export const circleLine = (card: CircleCard) =>
  [card.place, card.paceLabel].filter(Boolean).join(" · ") || "Open to join";
