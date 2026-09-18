import type { Reaction } from "@/core/types";
import type { ReactionPerson } from "./types";

export function reactionPeople(
  reactions: Reaction[],
  emoji?: string,
): ReactionPerson[] {
  const people = new Map<string, ReactionPerson>();
  reactions.forEach((reaction, index) => {
    if (emoji && reaction.emoji !== emoji) return;
    const key =
      reaction.user?.id ??
      reaction.userId ??
      reaction.user?.username ??
      reaction.id ??
      `unknown-${index}`;
    const person = people.get(key) ?? { key, user: reaction.user, emojis: [] };
    if (!person.emojis.includes(reaction.emoji))
      person.emojis.push(reaction.emoji);
    people.set(key, person);
  });
  return [...people.values()];
}
