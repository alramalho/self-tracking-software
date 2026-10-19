import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const output = path.resolve(process.env.SCREENSHOT_DIR || "../../docs/reviews/home-circle-faces");

const me = { name: "Rita Sousa", picture: null, onTrack: true, isMe: true };
const friend = { name: "Tomás Reis", picture: null, onTrack: false, isMe: false };
// The weekly plan's circle; the fixture's "fitness" plan has a home card.
const fitnessCircle = {
  id: "gym",
  name: "Exercise regularly",
  emoji: "💪",
  status: "ACTIVE",
  planId: "fitness",
  memberCount: 2,
  onTrack: 1,
  daysLeft: 4,
  pending: false,
  hasIntro: true,
  people: [me, friend],
};
// A circle whose plan has no card of its own on home keeps its circle card.
const orphanCircle = { ...fitnessCircle, id: "orphan", name: "Morning 10K", planId: "no-card-here", status: "FORMING", memberCount: 1, people: [me] };

for (const theme of ["LIGHT", "DARK"]) {
  test(`a plan's circle shows as faces on the plan card, not as a second card, in ${theme}`, async ({ page, request }) => {
    test.setTimeout(120000);
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await page.route("**/circles/mine", (route) => route.fulfill({ json: [fitnessCircle, orphanCircle] }));

    await page.goto("/");
    const faces = page.getByRole("button", { name: "Exercise regularly, 1 of 2 on track · 4 days left" });
    await expect(faces).toBeVisible();
    // The plan card holds the faces; no separate card repeats the plan's goal and status.
    await expect(page.getByText("1 of 2 on track · 4 days left", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Forming · 1 of 2", { exact: true })).toBeVisible();

    mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, `home-${theme}.png`) });

    await faces.click();
    await expect(page).toHaveURL(/\/circle\/gym/);
  });
}
