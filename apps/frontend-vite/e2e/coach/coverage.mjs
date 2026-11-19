// Checks the web "What did you cover?" ask on the harness (vite.coach.config.ts on :5196), light and dark.
// Run from apps/frontend-expo, which has Playwright: node ../frontend-vite/e2e/coach/coverage.mjs <outDir>
import { chromium, devices } from "@playwright/test";

const out = process.argv[2] ?? "coach-screens";
const base = "http://127.0.0.1:5196/e2e/coach/?view=coach&scenario=coverage";
const ok = (cond, message) => { if (!cond) throw new Error(message); };
const browser = await chromium.launch({ channel: "chrome" });
for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({ ...devices["iPhone 13"], colorScheme: theme, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${base}&theme=${theme}`);
  await page.getByText("What did you cover?").first().click();
  const send = page.getByTestId("coach-coverage-answer");
  ok(await send.isDisabled(), "Tell Helly should wait for text");
  await page.getByTestId("coverage-text").fill("Finished week 2 and most of week 3, ordering food");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${theme}-coverage-answer.png` });
  await send.click();
  await page.getByTestId("coverage-suggestion").waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${theme}-coverage-suggestion.png` });
  const requests = await page.evaluate(() => window.__requests);
  const put = requests.find((r) => r.method === "PUT" && r.url === "/activities/activity-entries/c1");
  const read = requests.find((r) => r.url === "/voice-logs/coverage");
  ok(put?.body.description.includes("week 3"), "note saved on the log");
  ok(read?.body.logged[0].activityId === "chinese" && /^\d{4}-\d{2}-\d{2}$/.test(read.body.logged[0].date), "coach read sent");
  // On track: the sheet just closes.
  const plain = await context.newPage();
  await plain.goto(`${base}&theme=${theme}`);
  await plain.getByText("What did you cover?").first().click();
  await plain.getByTestId("coverage-text").fill("Week 2 as planned");
  await plain.getByTestId("coach-coverage-answer").click();
  await plain.getByTestId("coverage-text").waitFor({ state: "detached" });
  // Not now posts the skip.
  const skip = await context.newPage();
  await skip.goto(`${base}&theme=${theme}`);
  await skip.getByText("What did you cover?").first().click();
  await skip.getByText("Not now").click();
  await skip.waitForTimeout(500);
  ok((await skip.evaluate(() => window.__requests)).some((r) => r.url === "/follow-through/plans/chinese/coverage/skip"), "skip posted");
  console.log(theme, "ok");
  await context.close();
}
await browser.close();
