import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const output = path.resolve("../../docs/reviews/circle-encouragement");
const member = {
  user: { id: "alex", name: "Alex Morgan", username: "alex", picture: null },
  plan: { id: "alex-plan", goal: "Run my first 10K", emoji: "🏃" },
  role: "MEMBER",
  joinedAt: "2026-08-01",
  pending: false,
  hasIntro: true,
  nudgedToday: true,
  week: {
    target: 4,
    done: 1,
    toGo: 3,
    daysLeft: 3,
    behind: true,
    isNew: false,
  },
};
const circle = {
  id: "encouragement",
  name: "Morning runners",
  emoji: "🏃",
  status: "ACTIVE",
  inviteCode: "invite",
  openToMatching: true,
  discoverable: true,
  place: "Lisbon",
  paceLabel: "4 a week",
  cap: 8,
  me: { role: "MEMBER", planId: "fitness", pending: false, hasIntro: true },
  members: [
    {
      ...member,
      user: { id: "test-user", name: "You", username: "you", picture: null },
      week: { ...member.week, done: 3, toGo: 1, behind: false },
    },
    member,
  ],
  togetherStreak: 0,
  recap: null,
};

for (const theme of ["LIGHT", "DARK"]) {
  test(`encouragement opens quietly, keeps failed drafts and sends only on request in ${theme}`, async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);
    const writes: { url: string; body: any }[] = [];
    let failSend = true;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await page.route("**/circles/**", async (route) => {
      const url = route.request().url();
      if (route.request().method() !== "GET")
        writes.push({ url, body: route.request().postDataJSON() });
      const data = url.endsWith("/feed")
        ? { entries: [], introIds: [] }
        : url.endsWith("/mine")
          ? [
              {
                ...circle,
                planId: "fitness",
                memberCount: 2,
                daysLeft: 3,
                onTrack: 1,
                people: [],
              },
            ]
          : circle;
      await route.fulfill({ json: data });
    });
    await page.route("**/chats/direct", async (route) => {
      writes.push({
        url: route.request().url(),
        body: route.request().postDataJSON(),
      });
      await route.fulfill({ json: { chat: { id: "alex-chat" } } });
    });
    await page.route("**/chats/alex-chat/messages", async (route) => {
      writes.push({
        url: route.request().url(),
        body: route.request().postDataJSON(),
      });
      await route.fulfill({
        status: failSend ? 503 : 200,
        json: failSend
          ? { error: "Couldn't send. Please try again." }
          : { message: { id: "encouragement-message" } },
      });
      failSend = false;
    });
    await page.goto("/circle/encouragement");
    await expect(
      page.getByRole("button", { name: "Motivate Alex", exact: true }),
    ).toBeVisible();
    mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, `board-${theme}.png`) });
    await page
      .getByRole("button", { name: "Motivate Alex", exact: true })
      .click();
    const drawer = page.getByTestId("motivate-drawer");
    await expect(
      drawer.getByRole("heading", { name: "Motivate Alex" }),
    ).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "Send encouragement" }),
    ).toBeDisabled();
    expect(writes).toHaveLength(0);
    await page.screenshot({ path: path.join(output, `drawer-${theme}.png`) });
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    expect(writes).toHaveLength(0);
    await page
      .getByRole("button", { name: "Motivate Alex", exact: true })
      .click();
    await drawer.getByRole("textbox", { name: "Your message" }).fill("   ");
    await expect(
      drawer.getByRole("button", { name: "Send encouragement" }),
    ).toBeDisabled();
    const text = "You've already made a start. Want to run together tomorrow?";
    await drawer
      .getByRole("textbox", { name: "Your message" })
      .fill(`  ${text}  `);
    await page.screenshot({ path: path.join(output, `message-${theme}.png`) });
    await drawer.getByRole("button", { name: "Send encouragement" }).click();
    await expect(
      drawer.getByText("Couldn't send. Please try again.", { exact: true }),
    ).toBeVisible();
    await expect(
      drawer.getByRole("textbox", { name: "Your message" }),
    ).toHaveValue(`  ${text}  `);
    await drawer.getByRole("button", { name: "Send encouragement" }).click();
    await expect(
      drawer.getByRole("heading", { name: "Sent to Alex" }),
    ).toBeVisible();
    expect(writes.filter((write) => write.url.endsWith("/direct"))).toEqual([
      {
        url: `${API}/chats/direct`,
        body: { userId: "alex", circleId: circle.id },
      },
    ]);
    expect(
      writes
        .filter((write) => write.url.endsWith("/messages"))
        .map((write) => write.body),
    ).toEqual([{ message: text }, { message: text }]);
    expect(writes.some((write) => write.url.endsWith("/nudges"))).toBe(false);
    await page.screenshot({ path: path.join(output, `sent-${theme}.png`) });
    await drawer.getByRole("button", { name: "Done" }).click();
    await page.goto("/plans");
    await page
      .getByRole("button", { name: "Exercise regularly", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Motivate Alex", exact: true })
      .click();
    await expect(
      drawer.getByRole("heading", { name: "Motivate Alex" }),
    ).toBeVisible();
    expect(writes).toHaveLength(3);
    await page.screenshot({
      path: path.join(output, `plan-drawer-${theme}.png`),
    });
    expect(errors).toEqual([]);
  });
}
