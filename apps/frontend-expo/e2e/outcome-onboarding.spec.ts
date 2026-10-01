import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { enterWelcomeAge } from "./onboarding-welcome";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const output = path.resolve("../../../output/onboarding-design/screens");
mkdirSync(output, { recursive: true });
const shots = !!process.env.CAPTURE_DESIGN;

async function capture(page: Page, name: string) {
  if (!shots) return;
  await page.waitForTimeout(700);
  // Hide Expo's dev badge, which is not part of the app.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const box = el.getBoundingClientRect();
      if (getComputedStyle(el).position === "fixed" && box.width < 120 && box.height < 120 && box.left < 80 && box.bottom > innerHeight - 120) el.style.display = "none";
    }
  });
  await page.screenshot({ path: path.join(output, `${name}.png`) });
}
const next = (page: Page, name = "Continue") => page.getByRole("button", { name, exact: true }).click();

async function start(page: Page, request: any, theme: string) {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
  await page.goto("/onboarding?preview=1");
  await enterWelcomeAge(page);
  await next(page);
}
async function answer(page: Page, heading: string | RegExp, text: string) {
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await page.getByRole("textbox", { name: "Your answer" }).fill(text);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
}
const steps = (page: Page) => page.getByRole("progressbar", { name: "Onboarding progress" });

for (const theme of ["LIGHT", "DARK"])
  test(`outcome goal: one ask per screen, two routes, the first two weeks (${theme})`, async ({ page, request }) => {
    test.setTimeout(120000);
    await start(page, request, theme);
    await expect(page.getByRole("heading", { name: "What's your goal?" })).toBeVisible();
    await page.getByRole("textbox", { name: "Your answer" }).fill("Finish my first half marathon");
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
    await capture(page, `half-marathon-01-goal-${theme}`);
    await next(page);

    await answer(page, "How much do you run now?", "Twice a week, about 5 km each. My easy 5 km takes 35–37 minutes. Longest run was 7 km.");
    await capture(page, `half-marathon-02-baseline-${theme}`);
    await next(page);

    await expect(page.getByRole("heading", { name: "Why does it matter?" })).toBeVisible();
    await page.getByRole("textbox", { name: "Your answer" }).fill("I want to finish it with my friends");
    await capture(page, `half-marathon-03-why-${theme}`);
    await next(page);

    // The coach's one extra question: a finish time is the runner's to choose, and they can decline.
    await expect(page.getByRole("heading", { name: "Do you have a finish time in mind?" })).toBeVisible();
    await capture(page, `half-marathon-04-target-${theme}`);
    await page.getByRole("button", { name: "No target in mind" }).click();

    await expect(page.getByRole("heading", { name: "How many days can you train?" })).toBeVisible();
    await page.getByRole("button", { name: "More days" }).click();
    await expect(page.getByTestId("design-days-value")).toHaveText("4");
    await capture(page, `half-marathon-05-days-${theme}`);
    await page.route("**/design/options", async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
    await next(page);
    await expect(page.getByTestId("design-loading")).toBeVisible();
    await capture(page, `half-marathon-06-planning-${theme}`);

    await expect(page.getByRole("heading", { name: "Choose your plan" })).toBeVisible();
    await expect(page.getByTestId("route-steady")).toContainText("Helly · Moderate");
    await expect(page.getByTestId("route-steady")).toContainText("3 days a week");
    await expect(page.getByTestId("route-focused")).toContainText("Oli · Intense");
    await expect(page.getByTestId("route-focused")).toContainText("4 days a week");
    await capture(page, `half-marathon-07-routes-${theme}`);

    await page.getByTestId("route-focused").click();
    await expect(page.getByTestId("two-weeks")).toBeVisible();
    await expect(page.getByTestId("session-detail")).toContainText("7:00–7:24 /km");
    await capture(page, `half-marathon-08-oli-first-day-${theme}`);
    await page.getByTestId("day-2026-10-06").click();
    await capture(page, `half-marathon-09-oli-day-${theme}`);
    await page.getByTestId("day-2026-10-07").click(); // a rest day opens too
    await expect(page.getByTestId("rest-day")).toBeVisible();
    await capture(page, `half-marathon-10-rest-day-${theme}`);
    await page.getByRole("button", { name: "Choose the other plan" }).click();
    await page.getByTestId("route-steady").click();
    await expect(page.getByRole("heading", { name: "Helly · 3 days a week" })).toBeVisible();
    await page.getByTestId("day-2026-10-10").click();
    await capture(page, `half-marathon-11-helly-long-run-${theme}`);
    await next(page);

    // The plan decides what the coach does, so there is no coaching question and no role to pick.
    await expect(page.getByTestId("coach-tour-role")).toBeVisible();
    await expect(page.getByText("What help do you want?")).toHaveCount(0);
    await expect(page.getByText(/coach this plan/i)).toHaveCount(0);
    await capture(page, `half-marathon-12-coach-${theme}`);
    await next(page);
    await next(page);
    await next(page, "Continue").catch(() => {});
    await expect(page.getByRole("heading", { name: "Do it with a group?" })).toBeVisible();
    await page.getByRole("button", { name: "Just me" }).click();
    await expect(page.getByTestId("coaching-paywall")).toBeVisible();
    await capture(page, `half-marathon-13-paywall-${theme}`);

    const state = await (await request.get(`${API}/__state`)).json();
    const options = state.requests.find((r: any) => r.path.endsWith("/design/options"));
    expect(options.body).toMatchObject({ availableDays: 4, fixedDate: null, baseline: expect.stringContaining("35–37") });
    // A declined target stays declined: nothing is sent as a chosen goal spec.
    expect(options.body.goalSpec.chosenByUser).toBe(false);
    expect(options.body.asked[0]).toMatchObject({ answer: "No target in mind" });
    expect(state.requests.filter((r: any) => r.path.endsWith("/interview"))).toHaveLength(0);
    void steps;
  });

for (const theme of ["LIGHT", "DARK"])
  test(`consistency goal: no routes, no dates, just the weekly target (${theme})`, async ({ page, request }) => {
    test.setTimeout(90000);
    await start(page, request, theme);
    await page.getByRole("textbox", { name: "Your answer" }).fill("Train 4x a week");
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
    await next(page);
    await answer(page, "How often do you train now?", "Two sessions a week, 40 minutes each.");
    await next(page);
    await expect(page.getByRole("heading", { name: "Why does it matter?" })).toBeVisible();
    await page.getByRole("button", { name: "Skip this question" }).click();
    await expect(page.getByRole("heading", { name: "How many times a week?" })).toBeVisible();
    for (let i = 0; i < 1; i++) await page.getByRole("button", { name: "More days" }).click();
    await expect(page.getByTestId("design-days-value")).toHaveText("4");
    await capture(page, `consistency-01-times-${theme}`);
    await next(page);
    await expect(page.getByTestId("coach-tour-role")).toBeVisible();
    await capture(page, `consistency-02-coach-${theme}`);
    const state = await (await request.get(`${API}/__state`)).json();
    expect(state.requests.filter((r: any) => r.path.endsWith("/design/options"))).toHaveLength(0);
    expect(state.requests.filter((r: any) => r.path.endsWith("/design/subgoal"))).toHaveLength(0);
  });

// The same screens for goals that are not running: loads and reps, a declined number, a skill.
const others = [
  { id: "bench", goal: "Bench press 80 kg for 5 reps", baselineHeading: "What do you bench now?", baseline: "60 kg for 5 reps, 3 sets. I lift 3 days a week, with a rack and a spotter.", target: null, days: 3, route: "route-steady", detail: "Bench day" },
  { id: "cutting", goal: "Lose fat while keeping my strength", baselineHeading: "What do you do now?", baseline: "I lift twice a week. Bench press 60 kg for 5 reps. I track my meals.", target: "How clothes fit", days: 2, route: "route-steady", detail: "Full body A" },
  { id: "guitar", goal: "Play a complete song smoothly", baselineHeading: "What can you play now?", baseline: "I know G, C, D and Em but change slowly. I practise twice a week for 15 minutes.", target: "My own song", days: 5, route: "route-focused", detail: "Chord changes" },
];
for (const theme of ["LIGHT", "DARK"])
  for (const o of others)
    test(`${o.id}: the same screens, measurable sessions (${theme})`, async ({ page, request }) => {
      test.setTimeout(90000);
      await start(page, request, theme);
      await page.getByRole("textbox", { name: "Your answer" }).fill(o.goal);
      await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
      await next(page);
      await answer(page, o.baselineHeading, o.baseline);
      await next(page);
      await expect(page.getByRole("heading", { name: "Why does it matter?" })).toBeVisible();
      await page.getByRole("button", { name: "Skip this question" }).click();
      if (o.target) {
        await expect(page.getByTestId("onboarding-art-goal")).toBeVisible();
        await capture(page, `${o.id}-01-target-${theme}`);
        await page.getByRole("button", { name: o.target }).click();
      }
      await expect(page.getByRole("heading", { name: "How many days can you train?" })).toBeVisible();
      const value = page.getByTestId("design-days-value");
      while (Number(await value.textContent()) !== o.days) await page.getByRole("button", { name: Number(await value.textContent()) < o.days ? "More days" : "Fewer days" }).click();
      await next(page);
      await expect(page.getByRole("heading", { name: "Choose your plan" })).toBeVisible();
      await capture(page, `${o.id}-02-routes-${theme}`);
      await page.getByTestId(o.route).click();
      await expect(page.getByTestId("session-detail")).toContainText(o.detail);
      await capture(page, `${o.id}-03-first-day-${theme}`);
    });
