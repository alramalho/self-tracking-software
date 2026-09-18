import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__reset`);
});

test("Health entries show Watch precision without decimal manual logging", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__timeline-design`, { data: { health: true } });
  await page.goto("/?activityEntryId=health-run");

  const card = page.getByTestId("feed-card");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Running - 6.3 km");
  await expect(card).toContainText("39 min");
  await expect(card).not.toContainText("Running - 6 kilometers");
});

for (const theme of ["DARK", "LIGHT"]) {
  test(`joint photo card and both viewer dismissals in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await request.post(`${API}/__timeline-design`);
    await page.goto("/?activityEntryId=joint-b");
    const card = page.getByTestId("feed-card");
    await expect(card).toHaveCount(1);
    await card.scrollIntoViewIfNeeded();
    await expect(
      card.getByText("JOINT ACTIVITY", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("joint-entry-joint-a")).toContainText(
      "Running - 5 kilometers",
    );
    await expect(page.getByTestId("joint-entry-joint-b")).toContainText(
      "Reading - 20 pages",
    );
    await expect(
      card.getByRole("button", { name: /^Open .* photo/ }),
    ).toHaveCount(3);
    await expect(page.getByTestId("joint-entry-joint-deleted")).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 1400 });
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({
      path: `test-results/timeline-joint-${theme.toLowerCase()}.png`,
    });
    await card.getByRole("button", { name: /^Open .* photo 1$/ }).click();
    await expect(page.getByTestId("close-photo")).toBeVisible();
    await page.getByTestId("close-photo").click();
    await expect(page.getByTestId("close-photo")).not.toBeVisible();
    await card.getByRole("button", { name: /^Open .* photo 3$/ }).click();
    const backdrop = page.getByTestId("photo-viewer-backdrop");
    await backdrop.click({ position: { x: 8, y: 8 } });
    await expect(page.getByTestId("close-photo")).not.toBeVisible();
    await card.getByRole("button", { name: "Comments (1)" }).click();
    await expect(page.getByTestId("comments-sheet").getByText("sam", { exact: true })).toBeVisible();
    await expect(page.getByTestId("comments-sheet").getByText("Great morning!", { exact: true })).toBeVisible();
  });
}
test("joint text card keeps both activities when expanded", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__timeline-design`, { data: { photos: false } });
  await page.goto("/");
  const expand = page.getByRole("button", { name: "Expand Reading 20 pages" });
  await expand.scrollIntoViewIfNeeded();
  await expect(expand).toContainText("@sam and @alex");
  await expect(expand).toContainText("Running (5 kilometers)");
  await expand.click();
  await expect(page.getByText("JOINT ACTIVITY", { exact: true })).toBeVisible();
  await expect(page.getByTestId("joint-entry-joint-a")).toBeVisible();
  await expect(page.getByTestId("joint-entry-joint-b")).toBeVisible();
});
