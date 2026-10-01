import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const output = path.resolve("../../docs/reviews/circle-momentum");

const person = (id: string, name: string, done: number, target: number, behind = false) => ({
  user: { id, name, username: id, picture: null },
  plan: { id: `${id}-plan`, goal: "Run a 10K", emoji: "🏃" },
  role: id === "test-user" ? "OWNER" : "MEMBER",
  joinedAt: "2026-08-01",
  pending: false,
  hasIntro: true,
  nudgedToday: false,
  week: { target, done, toGo: target - done, daysLeft: 4, behind, isNew: false },
});
const members = [
  person("test-user", "Rita Sousa", 2, 4),
  person("tomas", "Tomás Reis", 1, 3),
  person("mia", "Mia Costa", 2, 3),
  person("alex", "Alex Morgan", 1, 4),
  person("jonas", "Jonas Weber", 0, 4, true),
];
// Six finished weeks: sessions done per person, in board order.
const history: [string, number[]][] = [
  ["2026-08-16", [4, 3, 2, 3, 1]],
  ["2026-08-23", [4, 3, 3, 4, 2]],
  ["2026-08-30", [4, 3, 3, 4, 4]],
  ["2026-09-06", [4, 3, 3, 4, 4]],
  ["2026-09-13", [4, 3, 3, 2, 3]],
  ["2026-09-20", [4, 3, 3, 2, 1]],
];
const weeks = history.map(([start, done]) => {
  const people = members.map((m, i) => ({
    userId: m.user.id,
    done: done[i],
    target: m.week.target,
    hit: done[i] >= m.week.target,
  }));
  return { start, allHit: people.every((p) => p.hit), people };
});
const ranking = [
  ["test-user", 100, 1],
  ["tomas", 100, 1],
  ["mia", 94, 3],
  ["alex", 79, 4],
  ["jonas", 63, 5],
].map(([userId, percent, rank]) => ({
  userId,
  percent,
  rank,
  hits: weeks.map((w) => w.people.find((p) => p.userId === userId)!.hit),
}));
const circle = {
  id: "momentum",
  name: "Morning 10K",
  emoji: "🏃",
  status: "ACTIVE",
  inviteCode: "invite",
  openToMatching: true,
  discoverable: true,
  place: "Lisbon",
  paceLabel: "3–4 a week",
  cap: 8,
  coachPosts: true,
  me: { role: "OWNER", planId: "fitness", pending: false, hasIntro: true, muted: false },
  members,
  togetherStreak: 0,
  recap: null,
  pastWeeks: { weeks, ranking },
};
const entry = (id: string, member: (typeof members)[number], weekChip: { done: number; target: number }) => ({
  id,
  userId: member.user.id,
  activityId: `${member.user.id}-run`,
  quantity: 5,
  datetime: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  description: null,
  imageUrls: [],
  reactions: [],
  comments: [],
  _count: { comments: 0 },
  user: member.user,
  activity: { id: `${member.user.id}-run`, title: "Running", emoji: "🏃", measure: "km" },
  weekChip,
});

for (const theme of ["LIGHT", "DARK"]) {
  test(`circle page shows the orbit, past weeks and week chips, and the owner's switches in ${theme}`, async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);
    const writes: { url: string; body: any }[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await page.route("**/circles/**", async (route) => {
      const url = route.request().url();
      if (route.request().method() !== "GET") {
        writes.push({ url, body: route.request().postDataJSON() });
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      const data = url.endsWith("/feed")
        ? { entries: [entry("done", members[0], { done: 4, target: 4 }), entry("comeback", members[4], { done: 1, target: 4 })], introIds: [] }
        : url.endsWith("/mine")
          ? []
          : circle;
      await route.fulfill({ json: data });
    });

    await page.goto("/circle/momentum");
    await expect(page.getByLabel("5 people in this circle")).toBeVisible();
    await expect(page.getByRole("button", { name: "Past weeks" })).toContainText("you're at 100%");
    // The streak and "Last week" cards are gone: one row leads to the chart instead.
    await expect(page.getByText("Last week", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Week done ✅ 4 of 4", { exact: true })).toBeVisible();
    await expect(page.getByText("1 of 4 this week", { exact: true })).toBeVisible();
    mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, `circle-${theme}.png`) });
    await page.getByText("Week done ✅ 4 of 4", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `chips-${theme}.png`) });

    await page.getByRole("button", { name: "Past weeks" }).click();
    await expect(page.getByText("Most consistent", { exact: true })).toBeVisible();
    await expect(page.getByText("last 6 weeks", { exact: true })).toBeVisible();
    await expect(page.getByText("circle target 18", { exact: true })).toBeVisible();
    await expect(page.getByText("A square fills when you hit your week.", { exact: true })).toBeVisible();
    // Ranked by share of their own target; ties share a rank, and nobody is labelled last.
    await expect(page.getByRole("button", { name: "You, 100% of own target" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Jonas, 63% of own target" })).toBeVisible();
    // Let the sheet finish sliding in before the picture.
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(output, `past-weeks-${theme}.png`) });
    await page.getByRole("button", { name: "Jonas, 63% of own target" }).click();
    await expect(page.getByRole("button", { name: "Jonas, 63% of own target" })).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: path.join(output, `past-weeks-jonas-${theme}.png`) });
    await page.getByRole("button", { name: "Close", exact: true }).click();

    // On the web the ⋯ menu asks about each action in turn.
    const choose = async (label: string) => {
      const handler = (dialog: import("@playwright/test").Dialog) =>
        void (dialog.message() === `${label}?` ? dialog.accept() : dialog.dismiss());
      page.on("dialog", handler);
      await page.getByRole("button", { name: "Circle options" }).click();
      await expect.poll(() => writes.length).toBeGreaterThan(0);
      page.off("dialog", handler);
    };
    await choose("Turn off Helly's posts");
    expect(writes.pop()).toEqual({ url: `${API}/circles/momentum`, body: { coachPosts: false } });
    writes.length = 0;
    await choose("Mute notifications");
    expect(writes.pop()).toEqual({ url: `${API}/circles/momentum/membership`, body: { muted: true } });
    expect(errors).toEqual([]);
  });
}
