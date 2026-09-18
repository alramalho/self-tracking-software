import test from "node:test";
import assert from "node:assert/strict";
import { reactionPeople } from "../src/features/timeline/reactions/people";

test("reactors group by identity with all emoji, including production users lacking nested id", () => {
  const reactions = [
    { userId: "sam", user: { username: "sam" } as any, emoji: "🔥" },
    { userId: "sam", user: { username: "sam" } as any, emoji: "🚀" },
    { userId: "alex", emoji: "🔥" },
  ];
  assert.equal(reactionPeople(reactions).length, 2);
  assert.deepEqual(reactionPeople(reactions)[0].emojis, ["🔥", "🚀"]);
  assert.equal(reactionPeople(reactions, "🚀").length, 1);
  assert.equal(reactionPeople([{ emoji: "🔥" }, { emoji: "🔥" }]).length, 2);
});
