import assert from "node:assert/strict";
import test from "node:test";
import { exploreRows, mainPlan, matchingPeople, recommendedPeople } from "../src/features/explore/model";
import type { CircleCard } from "../src/features/circles/types";
import type { ExplorePerson, RecommendedUsers } from "../src/features/explore/types";

const circle = (id: string) => ({ id, name: id, emoji: "🏃" }) as CircleCard;
const person = (userId: string, goal: string | null = null): ExplorePerson => ({
  userId,
  username: userId,
  name: null,
  picture: null,
  plan: goal ? { goal, emoji: "📚" } : null,
});
const shape = (rows: ReturnType<typeof exploreRows>) =>
  rows.map((row) =>
    row.kind === "feature"
      ? `${row.side}:${row.circle.circle.card.id}|${row.people.map((p) => p.person.userId).join(",")}`
      : row.tiles.map((tile) => (tile.kind === "circle" ? tile.circle.card.id : tile.person.userId)).join(","),
  );

test("tall circles alternate sides with a row of two people between them", () => {
  const rows = exploreRows({
    circles: [circle("c1"), circle("c2")],
    joinedCircleIds: [],
    people: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"].map((id) => person(id)),
  });
  assert.deepEqual(shape(rows), ["left:c1|p1,p2", "p3,p4", "right:c2|p5,p6", "p7"]);
});

test("once people run out, the remaining circles fill rows of two", () => {
  const rows = exploreRows({
    circles: [circle("c1"), circle("c2"), circle("c3"), circle("c1")],
    joinedCircleIds: ["c3"],
    people: [person("p1"), person("p2"), person("p3")],
  });
  assert.deepEqual(shape(rows), ["left:c1|p1,p2", "p3,c2", "c3"]);
  const last = rows[2];
  assert.ok(last.kind === "pair" && last.tiles[0].kind === "circle" && last.tiles[0].circle.joined);
});

test("people follow their recommendation score and show the plan they put first", () => {
  const response: RecommendedUsers = {
    recommendations: [
      { recommendationObjectId: "b", score: 0.9 },
      { recommendationObjectId: "a", score: 0.4 },
    ],
    users: [
      { id: "a", username: "ana", name: "Ana", picture: null },
      { id: "b", username: "bo", name: "Bo", picture: "https://x/bo.jpg" },
      { id: "c", username: null, name: "No username" },
    ],
    plans: [
      { id: "a1", userId: "a", goal: "Read", emoji: "📚", sortOrder: 1 },
      { id: "a2", userId: "a", goal: "Run", emoji: "🏃", sortOrder: 0 },
      { id: "b1", userId: "b", goal: "Old", emoji: "🎸", createdAt: "2026-01-01", archivedAt: "2026-02-01" },
    ],
  };
  assert.deepEqual(recommendedPeople(response), [
    { userId: "b", username: "bo", name: "Bo", picture: "https://x/bo.jpg", plan: null },
    { userId: "a", username: "ana", name: "Ana", picture: null, plan: { goal: "Run", emoji: "🏃" } },
  ]);
  assert.equal(
    mainPlan([
      { id: "old", userId: "a", goal: "Old", createdAt: "2026-01-01" },
      { id: "new", userId: "a", goal: "New", createdAt: "2026-05-01" },
    ])?.id,
    "new",
  );
});

test("typed search shows your people first, then suggestions whose name or goal matches", () => {
  const suggested = [person("lia", "Read 20 books"), person("max", "Run a marathon"), person("readyfreddy")];
  const found = matchingPeople("@Read", [{ userId: "sam", username: "sam" }, { userId: "lia", username: "lia" }], suggested);
  assert.deepEqual(found.map((p) => p.userId), ["sam", "lia", "readyfreddy"]);
  assert.deepEqual(found[1].plan, { goal: "Read 20 books", emoji: "📚" });
});
