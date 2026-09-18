import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
let runtimeErrors: string[] = [];
test.afterEach(() => {
  expect(runtimeErrors).toEqual([]);
});
test.beforeEach(async ({ request, page }) => {
  runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("Text strings must be rendered")
    )
      runtimeErrors.push(message.text());
  });
  await request.post(`${API}/__reset`);
  await page.goto("/");
  await expect(
    page.getByText("Friend's last activities", { exact: true }),
  ).toBeVisible();
});
test("logs activity and updates timeline and profile history", async ({
  page,
  request,
}) => {
  await page.getByTestId("nav-add").click();
  await page.getByRole("button", { name: "Log Running", exact: true }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Log Activity", exact: true }).click();
  await page.getByLabel("Caption (optional)", { exact: true }).fill("Expo parity run");
  await page
    .getByRole("button", { name: "Log without photo", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    page.getByText("Log Your Metrics", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByTestId("nav-home").click();
  await page
    .getByRole("button", { name: "Expand Running 7 kilometers", exact: true })
    .click();
  await expect(
    page.getByText("Expo parity run").filter({ visible: true }),
  ).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.entries.find((e: any) => e.description === "Expo parity run")
      .quantity,
  ).toBe(7);
  const log = state.requests.find(
    (r: any) => r.path === "/activities/log-activity",
  );
  expect(log.body.timezone).toBe("Europe/Berlin");
  await page.getByTestId("nav-profile").click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page
      .getByTestId("profile-screen")
      .getByText("Expo parity run")
      .filter({ visible: true }),
  ).toBeVisible();
});
test("grid selects a date with both activities and retains pause styling", async ({
  page,
}) => {
  await page.getByTestId("nav-plans").click();
  await page
    .getByRole("button", { name: "Exercise regularly", exact: true })
    .click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("grid-day-details")).toContainText("Running");
  await expect(page.getByTestId("grid-day-details")).toContainText("Reading");
  await expect(
    page
      .getByTestId("plans-screen")
      .getByTestId("plan-card")
      .getByTestId("plan-week-progress")
      .filter({ visible: true }),
  ).toBeVisible();
  await page.getByTestId("nav-profile").click();
  await expect(
    page
      .getByTestId("profile-screen")
      .getByTestId("activity-heatmap")
      .filter({ visible: true }),
  ).toHaveCount(2);
});
test("edits and deletes an entry with cache refresh", async ({ page }) => {
  await page
    .getByRole("button", { name: "Expand Running 5 kilometers", exact: true })
    .click();
  const card = page.getByTestId("feed-card").filter({ hasText: "Morning run" });
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("9");
  await page.getByLabel("Description", { exact: true }).fill("Edited run");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByText("Edited run")).toBeVisible();
  await page
    .getByTestId("feed-card")
    .filter({ hasText: "Edited run" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete Activity", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm Delete", exact: true })
    .click();
  await expect(page.getByText("Edited run")).toHaveCount(0);
});
test("renders existing photos from both entry image fields", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__entry-photos`);
  await page.reload();
  const card = page.getByTestId("feed-card").filter({ hasText: "Morning run" });
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Activity photo", { exact: true })).toHaveCount(2);
});
test("reaction and comment contracts are preserved", async ({
  page,
  request,
}) => {
  await page
    .getByRole("button", { name: "Expand Running 5 kilometers", exact: true })
    .click();
  const card = page.getByTestId("feed-card").filter({ hasText: "Morning run" });
  await card.getByRole("button", { name: "React", exact: true }).click();
  await page.getByRole("button", { name: "♥️", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "♥️ 1", exact: true }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Comments", exact: true }).click();
  await page.getByLabel("Comment", { exact: true }).fill("Great work");
  await page.getByRole("button", { name: "Post Comment", exact: true }).click();
  await expect(
    page.getByTestId("comments-sheet").getByText("Great work", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete comment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm delete comment", exact: true })
    .click();
  await expect(
    page.getByTestId("comments-sheet").getByText("Great work", { exact: true }),
  ).toHaveCount(0);
});
test("metric check-ins update chart and day detail", async ({
  page,
  request,
}) => {
  await page.getByTestId("nav-metrics").click();
  await page.getByRole("button", { name: "Log Check-in", exact: true }).click();
  await page
    .getByRole("button", { name: "Energy rating 5", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mood rating 4", exact: true })
    .click();
  await page.getByLabel("Anything to add?").fill("Feeling good");
  await page
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await expect(page.getByText("Log Your Metrics", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Energy Trend", { exact: true })).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.metricEntries.some(
      (e: any) => e.rating === 5 && e.description === "Feeling good",
    ),
  ).toBe(true);
  expect(
    state.metricEntries.some(
      (e: any) => e.metricId === "mood" && e.rating === 4,
    ),
  ).toBe(true);
});
test("failed log keeps inputs and supports retry without a duplicate", async ({
  page,
  request,
}) => {
  await page.getByTestId("nav-add").click();
  await page.getByRole("button", { name: "Log Reading", exact: true }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Log Activity", exact: true }).click();
  await request.post(`${API}/__fail`, {
    data: { path: "/activities/log-activity" },
  });
  await page
    .getByRole("button", { name: "Log without photo", exact: true })
    .click();
  await expect(
    page.getByText("Simulated network failure. Please try again."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Log without photo", exact: true })
    .click();
  await expect(
    page.getByText("How did it feel?", { exact: true }),
  ).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.entries.filter((e: any) => e.quantity === 12)).toHaveLength(1);
});
test("creates weekly plan and edits existing plan", async ({
  page,
  request,
}) => {
  await page.getByTestId("nav-plans").click();
  await page
    .getByRole("button", { name: "Create New Plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Lifestyle", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByLabel("Great, now what exactly do you want to do?")
    .fill("Read more books");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByPlaceholder("Enter an emoji").fill("📚");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "📚 Reading", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Times per week").fill("4");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create Plan", exact: true }).click();
  await page
    .getByRole("button", { name: "Read more books", exact: true })
    .click();
  await expect(
    page
      .getByText("4 times per week", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await page
    .getByTestId("plan-settings-button")
    .filter({ visible: true })
    .click();
  await page.getByRole("button", { name: "Edit Plan", exact: true }).click();
  await page
    .getByLabel("Great, now what exactly do you want to do?")
    .fill("Read every week");
  await page
    .getByRole("button", { name: "Confirm Update", exact: true })
    .click();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.plans.some((p: any) => p.goal === "Read every week")).toBe(true);
});

test("all five main screens render in light and dark mode", async ({
  page,
}, testInfo) => {
  for (const theme of ["LIGHT", "DARK"]) {
    if (theme === "DARK") {
      await page.goto("/settings");
      await page.getByRole("button", { name: "Dark", exact: true }).click();
      await page.getByRole("button", { name: "Back", exact: true }).click();
    }
    for (const name of ["home", "add", "plans", "profile", "metrics"]) {
      await page.getByTestId(`nav-${name}`).click();
      if (name === "plans")
        await page
          .getByRole("button", { name: "Exercise regularly", exact: true })
          .click();
      await expect(page.getByTestId(`nav-${name}`)).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${theme.toLowerCase()}.png`),
      });
    }
  }
});

test("closing a partial check-in saves selected ratings only", async ({
  page,
  request,
}) => {
  await page.getByTestId("nav-metrics").click();
  await page.getByRole("button", { name: "Log Check-in", exact: true }).click();
  await page
    .getByRole("button", { name: "Mood rating 4", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  const state = await (await request.get(`${API}/__state`)).json();
  const writes = state.requests.filter(
    (request: any) =>
      request.path === "/metrics/entries" && request.method === "POST",
  );
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toMatchObject({ metricId: "mood", rating: 4 });
});

test("specific plan switches from completed history to scheduled sessions", async ({
  page,
}) => {
  await page.getByTestId("nav-plans").click();
  await page
    .getByRole("button", { name: "Read every day", exact: true })
    .click();
  const screen = page.getByTestId("plans-screen");
  await screen.getByTestId("display-future-activities-switch").click();
  await screen.getByRole("button", { name: "Today", exact: true }).click();
  await expect(screen.getByTestId("grid-day-details")).toContainText("10");
});

test("milestone progress survives unrelated plan edits", async ({
  page,
  request,
}) => {
  await page.getByTestId("nav-plans").click();
  await page
    .getByRole("button", { name: "Exercise regularly", exact: true })
    .click();
  const milestone = page.getByTestId("milestone-milestone-run");
  await expect(milestone).toContainText("20%");
  await milestone
    .getByRole("button", { name: "Increase milestone progress" })
    .click();
  await expect(milestone).toContainText("30%");
  await page.getByRole("button", { name: "Edit milestones" }).click();
  await page.getByLabel("Why is this important to you?").fill("Feel stronger");
  await page.getByRole("button", { name: "Confirm Update" }).click();
  await expect(page.getByTestId("plans-screen")).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.plans[0].milestones[0].progress).toBe(30);
  const edit = state.requests.findLast((r: any) => r.path === "/plans/upsert");
  expect(edit.body).not.toHaveProperty("milestones");
});

test("scheduled plan dates tolerate incomplete typing and validate before save", async ({
  page,
  request,
}) => {
  await page.goto("/edit-plan/scheduled");
  const date = page.getByLabel("Session 1 date", { exact: true });
  await date.fill("2026-");
  await page.getByRole("button", { name: "Confirm Update" }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter a valid date.");
  await date.fill("2026-09-15");
  await page.getByLabel("Session 1 quantity").fill("0");
  await page.getByRole("button", { name: "Confirm Update" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "quantity greater than zero",
  );
  await page.getByLabel("Session 1 quantity").fill("15");
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await page.getByRole("button", { name: "Confirm Update" }).click();
  await expect(page.getByTestId("plans-screen")).toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(state.plans.find((p: any) => p.id === "scheduled").visibility).toBe(
    "FRIENDS",
  );
});

test("another profile uses its own history and server account totals", async ({
  page,
}) => {
  await page.goto("/profile/sam");
  const profile = page.getByTestId("profile-screen");
  await expect(
    profile.getByRole("button", { name: "150 Points", exact: true }),
  ).toBeVisible();
  await expect(
    profile.getByRole("button", { name: "Silver level" }),
  ).toBeVisible();
  await profile.getByRole("button", { name: "History", exact: true }).click();
  await expect(profile.getByText("Sam's long run")).toBeVisible();
  await expect(profile.getByText("Morning run")).toHaveCount(0);
  await page.goto("/plan/friend-plan");
  await expect(page.getByText("Sam's running plan")).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("grid-day-details")).toContainText("12");
  await expect(
    page.getByRole("button", { name: "Manage Plan", exact: true }),
  ).toHaveCount(0);
});

test("long-press dragging reorders plan tiles and refresh preserves the order", async ({
  page,
  request,
}) => {
  await page.getByTestId("nav-plans").click();
  const first = page.getByRole("button", {
    name: "Exercise regularly",
    exact: true,
  });
  const second = page.getByRole("button", {
    name: "Read every day",
    exact: true,
  });
  await first.scrollIntoViewIfNeeded();
  const a = (await first.boundingBox())!;
  const b = (await second.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400); // Real native gesture activation requires a deliberate long press.
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(async () => {
      const state = await (await request.get(`${API}/__state`)).json();
      return state.plans.find((p: any) => p.id === "scheduled").sortOrder;
    })
    .toBe(0);
  await page.reload();
  await expect(second).toBeVisible();
  expect((await second.boundingBox())!.x).toBeLessThan(
    (await first.boundingBox())!.x,
  );
});

test("fractional activity quantities are rejected before any write", async ({
  page,
  request,
}) => {
  await page.getByTestId("nav-add").click();
  await page.getByRole("button", { name: "Log Running", exact: true }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("7.5");
  await page.getByRole("button", { name: "Log Activity", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("whole number");
  const state = await (await request.get(API + "/__state")).json();
  expect(
    state.requests.filter((r: any) => r.path === "/activities/log-activity"),
  ).toHaveLength(0);
});

test("achievement messages, editing and deletion use the backend contract", async ({
  page,
  request,
}) => {
  await request.post(API + "/__achievement");
  await page.reload();
  const card = page
    .getByTestId("feed-card")
    .filter({ hasText: "Habit Formed!" });
  await expect(card).toContainText("My first habit");
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Message", { exact: true }).fill("Still showing up");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(card).toContainText("Still showing up");
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Achievement Post", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm Delete", exact: true })
    .click();
  await expect(card).toHaveCount(0);
});

test("shared activity links open the referenced card", async ({ page }) => {
  await page.goto("/?activityEntryId=entry-run");
  await expect(
    page.getByTestId("feed-card").filter({ hasText: "Morning run" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Expand Running 5 kilometers",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("dark logging and metric sheets preserve contrast and surface errors", async ({
  page,
}, info) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByTestId("nav-add").click();
  await page.getByRole("button", { name: "Log Running", exact: true }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("7.5");
  await page.getByRole("button", { name: "Log Activity", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCSS(
    "color",
    "rgb(248, 113, 113)",
  );
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveCSS(
    "color",
    "rgb(250, 250, 250)",
  );
  await page.screenshot({
    path: info.outputPath("logger-dark-validation.png"),
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByTestId("nav-metrics").click();
  await page.getByRole("button", { name: "Log Check-in", exact: true }).click();
  await page
    .getByRole("button", { name: "Energy rating 5", exact: true })
    .click();
  await page.screenshot({ path: info.outputPath("metric-checkin-dark.png") });
});

test("profile ranking badges open points and streak standings", async ({
  page,
}) => {
  await page.getByTestId("nav-profile").click();
  await page
    .getByRole("button", { name: "Rank 1 points", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Rankings", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("16 pts", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Streaks", exact: true }).click();
  await expect(
    page.getByText("No streaks data yet", { exact: true }),
  ).toBeVisible();
});

test("timeline pairs compact cards and expands to full width without losing order", async ({
  page,
}) => {
  const first = page.getByRole("button", {
    name: "Expand Running 5 kilometers",
    exact: true,
  });
  await first.scrollIntoViewIfNeeded();
  const row = page.getByTestId("timeline-row").filter({ has: first });
  await expect(row.getByTestId("feed-card")).toHaveCount(2);
  const compact = await first.boundingBox();
  const rowBox = await row.boundingBox();
  expect(compact!.width).toBeLessThan(rowBox!.width * 0.55);
  expect(compact!.height).toBeLessThan(160);
  await expect(first.getByText("Running", { exact: true })).toHaveCSS(
    "font-family",
    "Inter-SemiBold",
  );
  await first.click();
  const full = page.getByTestId("feed-card").filter({ hasText: "Morning run" });
  await expect(full).toBeVisible();
  expect((await full.boundingBox())!.width).toBeGreaterThan(
    rowBox!.width * 0.95,
  );
  await full
    .getByRole("button", { name: "Collapse activity", exact: true })
    .click();
  await expect(first).toBeVisible();
  await expect(
    page
      .getByTestId("timeline-row")
      .filter({ has: first })
      .getByTestId("feed-card"),
  ).toHaveCount(2);
});

test("weekly summary counts distinct days, opens history and starts logging", async ({
  page,
}) => {
  await page.getByTestId("nav-plans").click();
  await page
    .getByRole("button", { name: "Exercise regularly", exact: true })
    .click();
  const progress = page.getByTestId("plan-week-progress");
  await expect(progress).toContainText("1/3");
  await page
    .getByRole("button", { name: "See all weeks", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "All weeks", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Log Running from plan", exact: true })
    .click();
  await expect(page.getByLabel("Quantity", { exact: true })).toBeVisible();
});

test("plan background uses multipart image upload and supports removal", async ({
  page,
  request,
}) => {
  await page.goto("/edit-plan/fitness");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Add background image", exact: true })
    .click();
  await (await chooser).setFiles("assets/icon.png");
  await expect(
    page.getByRole("button", { name: "Remove background image", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm Update", exact: true })
    .click();
  let state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.plans.find((plan: any) => plan.id === "fitness").backgroundImageUrl,
  ).toContain("/__background.png");
  const upload = state.requests.find(
    (r: any) => r.path === "/plans/upload-background-image",
  );
  expect(upload.body.image.type).toBe("image/png");
  expect(upload.body.image.size).toBeGreaterThan(0);
  await page.goto("/edit-plan/fitness");
  await page
    .getByRole("button", { name: "Remove background image", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm Update", exact: true })
    .click();
  state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.plans.find((plan: any) => plan.id === "fitness").backgroundImageUrl,
  ).toBeNull();
});
