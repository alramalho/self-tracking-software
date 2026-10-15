import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { enterWelcomeAge } from "./onboarding-welcome";
import { rate } from "./plan-confidence";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const output = path.resolve("../../../output/plan-confidence/screens");
mkdirSync(output, { recursive: true });
const shots = !!process.env.CAPTURE_CONFIDENCE;
if (shots && process.env.CAPTURE_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 664 } } });

async function capture(page: Page, name: string, settle = 700) {
  if (!shots) return;
  await page.waitForTimeout(settle);
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
const dialHeading = (page: Page) => page.getByRole("heading", { name: "How sure are you that you’ll stick to this?" });

async function start(page: Page, request: any, theme: string, goal: string, baselineHeading: string, baseline: string) {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme } });
  await page.goto("/onboarding?preview=1");
  await enterWelcomeAge(page);
  await next(page);
  await page.getByRole("textbox", { name: "Your answer" }).fill(goal);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  await next(page);
  await expect(page.getByRole("heading", { name: baselineHeading })).toBeVisible();
  await page.getByRole("textbox", { name: "Your answer" }).fill(baseline);
  await next(page);
  await expect(page.getByRole("heading", { name: "Why does it matter?" })).toBeVisible();
  await page.getByRole("button", { name: "Skip this question" }).click();
}

// The coach steps and "Do it with a group?" come first: the question is asked once everything is settled.
async function throughCoachAndCircle(page: Page) {
  await expect(page.getByTestId("coach-tour-role")).toBeVisible();
  await next(page);
  await next(page);
  await next(page).catch(() => {});
  await expect(page.getByRole("heading", { name: "Do it with a group?" })).toBeVisible();
  await page.getByRole("button", { name: "Just me" }).click();
}
async function outcomeTo(page: Page, request: any, theme: string, route: "route-steady" | "route-focused") {
  await start(page, request, theme, "Finish my first half marathon", "How much do you run now?", "Twice a week, about 5 km each. My easy 5 km takes 35–37 minutes.");
  await page.getByRole("button", { name: "No target in mind" }).click();
  await page.getByRole("button", { name: "More days" }).click();
  await next(page, "Ask my coach");
  await page.getByTestId(route).click();
  await expect(page.getByTestId("two-weeks")).toBeVisible();
  await next(page);
  await throughCoachAndCircle(page);
}

for (const theme of ["LIGHT", "DARK"])
  test(`unsure of Oli's route at the end: Helly's is offered, re-rated, then why not lower (${theme})`, async ({ page, request }) => {
    test.setTimeout(120000);
    await outcomeTo(page, request, theme, "route-focused");

    // The dial sweeps to 10 and settles on 5.
    await expect(dialHeading(page)).toBeVisible();
    await expect(page.getByText("Oli · 4–5 days a week")).toBeVisible();
    await capture(page, `01-dial-sweep-${theme}`, 450);
    await expect(page.getByTestId("confidence-score")).toHaveText("5");
    await capture(page, `02-dial-5-${theme}`, 1600);
    await next(page);

    await expect(page.getByRole("heading", { name: "Let’s make it a plan you’re sure of" })).toBeVisible();
    await expect(page.getByTestId("lighter-message")).toContainText("Helly’s route gets you there with 3–4 days a week");
    await capture(page, `03-lighter-offer-${theme}`);
    await next(page, "Make it lighter");

    // Rated again, for the plan they'll actually do.
    await expect(dialHeading(page)).toBeVisible();
    await expect(page.getByText("Helly · 3–4 days a week")).toBeVisible();
    await rate(page, 8);
    await expect(page.getByText("Pretty sure")).toBeVisible();
    await capture(page, `04-dial-8-${theme}`, 1600);
    await next(page);

    await expect(page.getByRole("heading", { name: "Why an 8, and not a 5?" })).toBeVisible();
    await expect(page.getByTestId("confidence-dial-compact")).toBeVisible();
    await capture(page, `05-why-empty-${theme}`);
    await page.getByRole("textbox", { name: "Your answer" }).fill("I already run twice a week, and three friends signed up with me.");
    await capture(page, `06-why-answered-${theme}`);
    await next(page);
    await expect(page.getByTestId("coaching-paywall")).toBeVisible();
    // The paywall follows the route they ended on.
    await expect(page.getByTestId("paywall-compare")).toContainText("With Helly");
    await capture(page, `07-paywall-after-${theme}`);
  });

for (const theme of ["LIGHT", "DARK"])
  test(`unsure of Helly's route: nothing lighter without new weeks, so it asks what would make it a 7 (${theme})`, async ({ page, request }) => {
    test.setTimeout(120000);
    await outcomeTo(page, request, theme, "route-steady");
    await expect(dialHeading(page)).toBeVisible();
    await rate(page, 6);
    await next(page);
    await expect(page.getByRole("heading", { name: "What would make it a 7?" })).toBeVisible();
    await page.getByRole("textbox", { name: "Your answer" }).fill("Knowing I can swap a day when work runs late.");
    await capture(page, `08-helly-unsure-why-${theme}`);
  });

for (const theme of ["LIGHT", "DARK"])
  test(`habit: a low score is offered one time fewer (${theme})`, async ({ page, request }) => {
    test.setTimeout(120000);
    await start(page, request, theme, "Train 4x a week", "How often do you train now?", "Two sessions a week, 40 minutes each.");
    await expect(page.getByRole("heading", { name: "How many times a week?" })).toBeVisible();
    await page.getByRole("button", { name: "More days" }).click();
    await next(page);
    await throughCoachAndCircle(page);
    await expect(dialHeading(page)).toBeVisible();
    await expect(page.getByText("4 times a week")).toBeVisible();
    await rate(page, 3);
    await expect(page.getByText("Not sure yet")).toBeVisible();
    await capture(page, `09-habit-dial-3-${theme}`, 1600);
    await next(page);
    await expect(page.getByTestId("lighter-message")).toContainText("How about 3 times a week?");
    await capture(page, `10-habit-lighter-${theme}`);
    await next(page, "Make it lighter");
    await expect(page.getByText("3 times a week")).toBeVisible();
    await rate(page, 7);
    await next(page);
    await expect(page.getByRole("heading", { name: "Why a 7, and not a 4?" })).toBeVisible();
    await page.getByRole("button", { name: "Skip this question" }).click();
    await expect(page.getByTestId("coaching-paywall")).toBeVisible();
  });
