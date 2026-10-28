// The iPhone app keeps its own copy of the explore grid; both must lay out the same tiles.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as app from "../../frontend-expo/src/features/explore/model.ts";
import { exploreRows, matchingPeople } from "../src/components/explore/model.ts";

const circle = (id: string) => ({ id, name: id, emoji: "🏃" }) as never;
const person = (userId: string) => ({ userId, username: userId, name: null, picture: null, plan: { goal: "Run", emoji: "🏃" } });

test("the web app lays out the same grid as the iPhone app", () => {
  const sources = {
    circles: [circle("c1"), circle("c2"), circle("c3")],
    joinedCircleIds: ["c2"],
    people: ["p1", "p2", "p3", "p4", "p5"].map(person),
  };
  assert.deepEqual(exploreRows(sources), app.exploreRows(sources));
  assert.deepEqual(matchingPeople("ru", [], sources.people), app.matchingPeople("ru", [], sources.people));
});
