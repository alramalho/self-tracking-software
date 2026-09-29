import { describe, expect, it } from "vitest";
import { halfwayPost, weekRecapPost } from "./model";

describe("coach posts in a circle", () => {
  it("names who fell short, kindly, and asks the circle to back them", () => {
    const post = weekRecapPost(
      [
        { name: "Rita", done: 4, target: 4, hit: true },
        { name: "Tomás", done: 3, target: 3, hit: true },
        { name: "Jonas", done: 1, target: 4, hit: false },
      ],
      0,
    );
    expect(post).toBe(
      [
        "Week recap 🏁",
        "✅ Rita 4/4 · Tomás 3/3",
        "💪 Jonas 1/4",
        "Jonas, a fresh week starts now. What's one session you'll lock in for Monday?",
        "Everyone, drop Jonas a word 👇",
      ].join("\n"),
    );
  });

  it("celebrates a week where everyone hit their target, with the streak", () => {
    const post = weekRecapPost(
      [
        { name: "Alex", done: 4, target: 4, hit: true },
        { name: "Lia", done: 5, target: 4, hit: true },
      ],
      3,
    );
    expect(post).toContain("🔥 Everyone hit their week. That's 3 weeks together.");
  });

  it("groups several people who missed", () => {
    const post = weekRecapPost(
      [
        { name: "A", done: 1, target: 3, hit: false },
        { name: "B", done: 0, target: 2, hit: false },
        { name: "C", done: 2, target: 4, hit: false },
      ],
      0,
    )!;
    expect(post).toContain("A, B and C, a fresh week starts now.");
    expect(post).toContain("Everyone, drop them a word 👇");
  });

  it("needs at least two people, and stays quiet midweek when nobody is behind", () => {
    expect(weekRecapPost([{ name: "Solo", done: 3, target: 3, hit: true }], 0)).toBeNull();
    expect(halfwayPost([])).toBeNull();
  });

  it("calls out who needs a push midweek", () => {
    expect(halfwayPost([{ name: "Jonas", toGo: 3, daysLeft: 3 }])).toBe(
      ["Halfway check 👀", "Jonas needs 3 more in 3 days.", "Who's joining Jonas for a session? Reply here or send a nudge 👋"].join("\n"),
    );
    expect(
      halfwayPost([
        { name: "Jonas", toGo: 3, daysLeft: 3 },
        { name: "Mia", toGo: 1, daysLeft: 3 },
      ]),
    ).toContain("Jonas needs 3 more in 3 days, Mia 1 more.");
  });
});
