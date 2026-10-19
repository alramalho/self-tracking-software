// Captures the web Coach tab screens in light and dark from the harness (vite.coach.config.ts on :5196).
// Run from apps/frontend-expo, which has Playwright: node ../frontend-vite/e2e/coach/capture.mjs <outDir>
import { chromium, devices } from "@playwright/test";

const out = process.argv[2] ?? "coach-screens";
const base = "http://127.0.0.1:5196/e2e/coach/";
const shots = [
  { name: "coach", view: "coach" },
  { name: "coach-drawer", view: "coach", open: "Practice guitar has gone quiet" },
  { name: "coach-missed", view: "coach", open: "Read before bed missed last week" },
  { name: "plans", view: "plan" },
  { name: "plans-history", view: "plan", scroll: true },
  { name: "plan-drawer", view: "plan", button: "Plan settings" },
  { name: "home", view: "home" },
  { name: "profile", view: "profile" },
];
const browser = await chromium.launch({ channel: "chrome" });
for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({ ...devices["iPhone 13"], colorScheme: theme, reducedMotion: "reduce" });
  for (const shot of shots) {
    const page = await context.newPage();
    await page.goto(`${base}?view=${shot.view}&theme=${theme}`);
    await page.waitForTimeout(1200);
    if (shot.open) await page.getByText(shot.open).first().click();
    if (shot.button) await page.getByRole("button", { name: shot.button }).click();
    if (shot.scroll) await page.mouse.wheel(0, 900);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${theme}-${shot.name}.png` });
    await page.close();
  }
  await context.close();
}
await browser.close();
console.log("captured", shots.length * 2);
