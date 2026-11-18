import { expect, test } from "@playwright/test";
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };

test.use({ timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone });

// The step that fills on a log must only ever grow: no spring that overshoots and pulls back (owner, 18 Nov 2026).
test("the new step fills once and never pulls back", async ({ page, request }) => {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { themeMode: "DARK" } });
  await request.post(`${API}/__plan-nudges`, { headers, data: {} });
  // No earlier logs this week, so this log fills the first step.
  await page.route("**/activities/activity-entries", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ json: [] });
  });
  await page.goto("/add");
  await page.getByRole("button", { name: "Log Running", exact: true }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Log Activity", exact: true }).click();
  await page.getByRole("button", { name: "Log without photo", exact: true }).click();
  const fill = page.getByTestId("log-celebration-filling");
  await expect(fill).toBeAttached({ timeout: 8000 });
  // Every animation frame for 6 s: the fill's width as a share of its track.
  const samples: number[] = await fill.evaluate(
    (el) =>
      new Promise<number[]>((resolve) => {
        const out: number[] = [];
        const start = performance.now();
        const tick = () => {
          const track = el.parentElement!.getBoundingClientRect().width;
          out.push(Math.round((el.getBoundingClientRect().width / track) * 1000) / 1000);
          if (performance.now() - start < 6000) requestAnimationFrame(tick);
          else resolve(out);
        };
        tick();
      }),
  );
  const visible = samples.map((v) => Math.min(1, v));
  const peak = Math.max(...visible);
  const firstFull = visible.findIndex((v) => v >= 0.999);
  const afterFull = firstFull >= 0 ? visible.slice(firstFull) : [];
  console.log(`FILL samples=${samples.length} peak=${peak} rawMax=${Math.max(...samples)} minAfterFull=${afterFull.length ? Math.min(...afterFull) : "n/a"}`);
  console.log(`FILL trace ${samples.filter((_, i) => i % 3 === 0).join(" ")}`);
  expect(peak).toBeGreaterThan(0.99);
  expect(Math.min(...afterFull)).toBeGreaterThan(0.995);
});
