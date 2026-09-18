import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
for (const theme of ["DARK", "LIGHT"]) {
  test(`workout review and sleep breakdown in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    const decisions: unknown[] = [];
    let resolved = false,
      failOnce = true;
    await page.route("**/health/apple/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      let body: unknown;
      if (pathname.endsWith("/status"))
        body = {
          connected: true,
          lastSyncCompletedAt: "2026-09-15T08:00:00Z",
          importStats: { sleepSampleCount: 20 },
        };
      else if (pathname.endsWith("reconciliation-preview"))
        body = {
          summary: { pending: resolved ? 0 : 1 },
          items: resolved
            ? []
            : [
                {
                  healthWorkout: {
                    id: "run",
                    displayName: "Running",
                    activityTypeName: "running",
                    startAt: "2026-09-15T07:00:00Z",
                    endAt: "2026-09-15T07:30:00Z",
                    durationSeconds: 1800,
                    distanceMeters: 5100,
                    effortScore: 6,
                    effortSource: "apple_estimated",
                    difficulty: "moderate",
                    averageHeartRateBpm: 151.4,
                    sourceName: "Apple Watch",
                  },
                  category: "match",
                  recommendedAction: null,
                  resolved: null,
                  mismatches: [
                    {
                      code: "value_mismatch",
                      severity: "conflict",
                      label: "Apple Health and tracking.so values differ",
                    },
                  ],
                  suggestedActivity: null,
                  candidates: [
                    {
                      activityEntryId: "entry",
                      activityTitle: "Running",
                      activityMeasure: "kilometers",
                      quantity: 5,
                      datetime: "2026-09-15T07:30:00Z",
                      comparison: { compatible: true, healthValue: 5.1 },
                    },
                  ],
                },
              ],
        };
      else if (pathname.endsWith("/reconcile")) {
        if (failOnce) {
          failOnce = false;
          await route.fulfill({
            status: 503,
            json: { error: "Sync unavailable. Try again." },
          });
          return;
        }
        decisions.push(route.request().postDataJSON());
        resolved = true;
        body = { linked: 1 };
      } else if (pathname.endsWith("/daily-metrics"))
        body = {
          metrics: [
            {
              localDate: "2026-09-14",
              metric: "resting_heart_rate",
              aggregation: "most_recent",
              value: 58,
              unit: "bpm",
              provider: "apple_health",
              sourceName: "Apple Watch",
            },
            {
              localDate: "2026-09-15",
              metric: "resting_heart_rate",
              aggregation: "most_recent",
              value: 56,
              unit: "bpm",
              provider: "apple_health",
              sourceName: "Apple Watch",
            },
            {
              localDate: "2026-09-14",
              metric: "heart_rate_variability_sdnn",
              aggregation: "average",
              value: 44,
              unit: "ms",
              provider: "apple_health",
              sourceName: "Apple Watch",
            },
            {
              localDate: "2026-09-15",
              metric: "heart_rate_variability_sdnn",
              aggregation: "average",
              value: 48,
              unit: "ms",
              provider: "apple_health",
              sourceName: "Apple Watch",
            },
          ],
        };
      else if (pathname.endsWith("/sleep"))
        body = {
          scores: [
            {
              date: "2026-09-15",
              total: 91,
              asleepMinutes: 465,
              awakeMinutes: 12,
              awakenings: 3,
              baselineNights: 13,
              durationPoints: 47,
              consistencyPoints: 27,
              interruptionPoints: 17,
              bedtimeDeviationMinutes: 18,
              status: "ready",
            },
            {
              date: "2026-09-14",
              total: null,
              asleepMinutes: 380,
              awakeMinutes: 0,
              awakenings: 1,
              baselineNights: 6,
              status: "learning",
              durationPoints: 31,
              consistencyPoints: null,
              interruptionPoints: 20,
            },
          ],
        };
      else body = {};
      await route.fulfill({ json: body });
    });
    await page.goto("/health");
    await page.getByRole("button", { name: "Review workout", exact: true }).click();
    const drawer = page.getByTestId("health-workout-drawer");
    await expect(
      drawer.getByText("Counts once. Your notes and photos stay."),
    ).toBeVisible();
    await expect(
      drawer.getByText("Watch estimate · Moderate", { exact: true }),
    ).toBeVisible();
    await expect(
      drawer.getByText("Apple Health · 151 bpm average", { exact: true }),
    ).toBeVisible();
    await expect(drawer.getByText("Watch data stays private", { exact: true })).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/workout-review-${theme}.png` });
    await drawer.getByRole("button", { name: "Change Watch data privacy" }).click();
    await drawer.getByRole("button", { name: "Share with activity", exact: true }).click();
    await drawer
      .getByRole("button", { name: "Link workout", exact: true })
      .click();
    await expect(
      drawer.getByText("Sync unavailable. Try again."),
    ).toBeVisible();
    await drawer
      .getByRole("button", { name: "Link workout", exact: true })
      .click();
    await expect(drawer).toBeHidden();
    expect(decisions).toEqual([
      {
        decisions: [
          {
            healthWorkoutId: "run",
            action: "link_keep",
            activityEntryId: "entry",
            shareHealthData: true,
          },
        ],
      },
    ]);
    await page.goto("/metrics");
    await expect(
      page.getByRole("heading", { name: "Check-ins", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Health", exact: true }).click();
    await expect(page.getByTestId("metrics-health-view")).toBeVisible();
    await expect(page.getByTestId("health-vitals").getByText("Resting heart rate", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Check-ins", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check-ins", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Health", exact: true }).click();
    const sleep = page.getByTestId("sleep-metric");
    await expect(sleep.getByText("91", { exact: true }).first()).toBeVisible();
    await expect(sleep.getByText("Duration", { exact: true })).toBeVisible();
    await expect(sleep.getByText("47/50", { exact: true })).toBeVisible();
    // Each component and each night shows a bar against its own fixed scale,
    // so the card reads as bars even before a total is available.
    await expect(
      sleep.getByRole("progressbar", { name: "Duration score" }),
    ).toBeVisible();
    await expect(
      sleep.getByRole("progressbar", { name: "Consistency score" }),
    ).toBeVisible();
    await expect(
      sleep.getByRole("progressbar", { name: "Interruptions score" }),
    ).toBeVisible();
    await expect(
      sleep.getByRole("progressbar", { name: "Time asleep on 2026-09-15" }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/health-sleep-${theme}.png`,
      fullPage: true,
    });
    await sleep.getByTestId("sleep-range-1M").click();
    await expect(sleep.getByTestId("sleep-grid")).toBeVisible();
    await expect(
      sleep.getByText(/Empty days mean no sleep data was recorded/),
    ).toBeVisible();
    await sleep.getByTestId("sleep-range-6M").click();
    await expect(sleep.getByTestId("sleep-grid")).toBeVisible();
    await sleep.getByTestId("sleep-range-7D").click();
    await sleep.getByRole("button", { name: "Sleep on 2026-09-14" }).click();
    await expect(sleep.getByText("Learning your pattern")).toBeVisible();
    await expect(sleep.getByText("out of 100")).toBeHidden();
    // A night still being learned shows an empty consistency bar rather than a
    // zero, and keeps the daylight bar for time asleep.
    await expect(
      sleep.getByRole("progressbar", { name: "Time asleep on 2026-09-14" }),
    ).toBeVisible();
  });
}

test("sleep appears as a contributor on the metric insights island", async ({
  page,
  request,
}) => {
  const headers = { Authorization: "Bearer local-e2e-token" };
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__health`, { headers });
  await page.goto("/metrics");
  await page.getByRole("button", { name: "Check-ins", exact: true }).click();
  const insights = page.getByTestId("metric-insights-island");
  await insights.scrollIntoViewIfNeeded();
  const row = insights.getByTestId("correlation-sleep-score");
  await expect(row).toBeVisible();
  await expect(row.getByText(/Sleep score/)).toBeVisible();
  // The row stays one bar like the activity rows; the bands live behind the
  // expander so the island does not read as a wall of sleep copy.
  await expect(row.getByRole("progressbar").first()).toBeVisible();
  await expect(row.getByText("Good nights", { exact: true })).toBeHidden();
  await row.getByRole("button", { name: "Sleep score details" }).click();
  await expect(row.getByText("Good nights", { exact: true })).toBeVisible();
  await expect(row.getByText(/avg rating/).first()).toBeVisible();
  await row
    .getByRole("button", { name: /Sleep score reliability:/ })
    .click();
  await expect(page.getByText(/Nights compared: \d+/)).toBeVisible();
  await expect(
    page.getByText(/Sleep pairs each check-in with the night/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await row.getByRole("button", { name: "Sleep score details" }).click();
  await expect(row.getByText("Good nights", { exact: true })).toBeHidden();
});

test("sleep stays a contributor while every night is still learning", async ({
  page,
  request,
}) => {
  const headers = { Authorization: "Bearer local-e2e-token" };
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__health`, { headers, data: { learning: true } });
  await page.goto("/metrics");
  await page.getByRole("button", { name: "Check-ins", exact: true }).click();
  const insights = page.getByTestId("metric-insights-island");
  await insights.scrollIntoViewIfNeeded();
  const row = insights.getByTestId("correlation-sleep-score");
  await expect(row).toBeVisible();
  // The row, its correlation and its bars are present before any total
  // exists: quality is estimated from the measured components, and the copy
  // says so instead of pretending the score was settled.
  await expect(row.getByText(/[+\u2013-]\s?\d+%/)).toBeVisible();
  await expect(row.getByRole("progressbar").first()).toBeVisible();
  await row.getByRole("button", { name: "Sleep score details" }).click();
  await expect(row.getByText("Good nights", { exact: true })).toBeVisible();
  await expect(row.getByText(/estimated from their measured components/)).toBeVisible();
});

test("Home reviews pending workouts as one continuous batch", async ({
  page,
  request,
}) => {
  const headers = { Authorization: "Bearer local-e2e-token" };
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__health`, { headers });
  const resolved = new Set<string>();
  const decisions: Array<{ decisions: Array<{ healthWorkoutId: string }> }> =
    [];
  const workouts = [
    {
      healthWorkout: {
        id: "batch-run",
        displayName: "Running",
        activityTypeName: "running",
        startAt: "2026-09-15T07:00:00Z",
        endAt: "2026-09-15T07:30:00Z",
        durationSeconds: 1800,
        distanceMeters: 5100,
        averageHeartRateBpm: 151,
        sourceName: "Apple Watch",
      },
      category: "match",
      recommendedAction: "link_keep",
      resolved: null,
      mismatches: [],
      suggestedActivity: null,
      candidates: [
        {
          activityEntryId: "entry-run",
          activityTitle: "Running",
          activityEmoji: "🏃",
          activityMeasure: "kilometers",
          quantity: 5,
          datetime: "2026-09-15T07:30:00Z",
          comparison: { compatible: true, healthValue: 5.1 },
        },
      ],
    },
    {
      healthWorkout: {
        id: "batch-strength",
        displayName: "Strength Training",
        activityTypeName: "strength_training",
        startAt: "2026-09-14T18:00:00Z",
        endAt: "2026-09-14T18:40:00Z",
        durationSeconds: 2400,
        distanceMeters: null,
        sourceName: "Apple Watch",
      },
      category: "match",
      recommendedAction: "link_keep",
      resolved: null,
      mismatches: [],
      suggestedActivity: null,
      candidates: [
        {
          activityEntryId: "entry-strength",
          activityTitle: "Gym",
          activityEmoji: "🏋️",
          activityMeasure: "minutes",
          quantity: 40,
          datetime: "2026-09-14T18:05:00Z",
          comparison: { compatible: true, healthValue: 40 },
        },
      ],
    },
  ];
  await page.route("**/health/apple/workouts/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("reconciliation-preview")) {
      const items = workouts.filter(
        (item) => !resolved.has(item.healthWorkout.id),
      );
      await route.fulfill({
        json: {
          summary: { pending: items.length },
          items,
        },
      });
      return;
    }
    if (pathname.endsWith("/reconcile")) {
      const body = route.request().postDataJSON() as {
        decisions: Array<{ healthWorkoutId: string }>;
      };
      decisions.push(body);
      for (const decision of body.decisions)
        resolved.add(decision.healthWorkoutId);
      await route.fulfill({ json: { linked: 1 } });
      return;
    }
    await route.continue();
  });
  await page.goto("/");
  await expect(page.getByText("2 workouts ready", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/home-health-card-DARK.png" });
  await page
    .getByRole("button", { name: "Review workouts", exact: true })
    .click();
  const drawer = page.getByTestId("health-workout-drawer");
  await expect(drawer.getByText("Workout 1 of 2", { exact: true })).toBeVisible();
  await drawer
    .getByRole("button", { name: "Link workout", exact: true })
    .click();
  await expect(drawer.getByText("Workout 2 of 2", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Strength Training", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/workout-batch-DARK.png" });
  await drawer
    .getByRole("button", { name: "Link workout", exact: true })
    .click();
  await expect(drawer).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Review workouts", exact: true }),
  ).toBeHidden();
  expect(decisions.map((decision) => decision.decisions[0].healthWorkoutId)).toEqual([
    "batch-run",
    "batch-strength",
  ]);
});

for (const choice of ["create", "choose", "skip"] as const) {
  test(`Home review can ${choice} without an extra manual log`, async ({
    page,
    request,
  }) => {
    const headers = { Authorization: "Bearer local-e2e-token" };
    await request.post(`${API}/__reset`);
    await request.post(`${API}/__health`, { headers });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Review workouts", exact: true })
      .click();
    const drawer = page.getByTestId("health-workout-drawer");
    if (choice !== "skip")
      await drawer
        .getByRole("button", { name: "Change workout match", exact: true })
        .click();
    if (choice === "create") {
      await drawer
        .getByRole("button", { name: "Create activity", exact: true })
        .click();
      await drawer.getByRole("textbox").fill("Morning cardio");
      await expect(
        drawer.getByText("Create Morning cardio and log 30 minutes."),
      ).toBeVisible();
    } else if (choice === "choose") {
      await drawer
        .getByRole("button", { name: "🏃 Running", exact: true })
        .click();
      await expect(
        drawer.getByText("Adds one new log: 5 kilometers."),
      ).toBeVisible();
    }
    await drawer
      .getByRole("button", {
        name:
          choice === "skip"
            ? "Skip this workout"
            : choice === "create"
              ? "Create and log workout"
              : "Log workout",
        exact: true,
      })
      .click();
    await expect(drawer).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Review workouts", exact: true }),
    ).toBeHidden();
    const state = await (await request.get(`${API}/__state`)).json();
    const writes = state.requests.filter(
      (r: { method: string; path: string }) =>
        r.method === "POST" && r.path.endsWith("/reconcile"),
    );
    expect(writes.map((r: { body: unknown }) => r.body)).toEqual([
      {
        decisions: [
          {
            healthWorkoutId: "health-run",
            ...(choice === "skip"
              ? { action: "ignore" }
              : choice === "choose"
                ? { action: "import_new", activityId: "run", shareHealthData: false }
                : {
                    action: "import_new",
                    shareHealthData: false,
                    newActivity: {
                      title: "Morning cardio",
                      measure: "minutes",
                    },
                  }),
          },
        ],
      },
    ]);
    expect(
      state.requests.filter(
        (r: { path: string }) => r.path === "/activities/log-activity",
      ),
    ).toEqual([]);
  });
}

test("ambiguous workouts require a deliberate choice", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__health`, {
    headers: { Authorization: "Bearer local-e2e-token" },
  });
  await page.route(
    "**/health/apple/workouts/reconciliation-preview",
    async (route) => {
      const response = await route.fetch();
      const preview = await response.json();
      for (const item of preview.items) {
        item.recommendedAction = null;
        item.mismatches = [
          {
            code: "ambiguous_match",
            severity: "conflict",
            label: "Two logs could match this workout",
          },
        ];
        item.candidates.push({
          ...item.candidates[0],
          activityEntryId: "second-run",
          datetime: "2026-09-15T09:00:00Z",
        });
      }
      await route.fulfill({ json: preview });
    },
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Review workouts", exact: true })
    .click();
  const drawer = page.getByTestId("health-workout-drawer");
  await expect(drawer.getByText("Choose a match", { exact: true })).toBeVisible();
  await expect(
    drawer.getByText("Two logs could match this workout", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Back to workout", exact: true }),
  ).toBeHidden();
  await drawer
    .getByRole("button", { name: /Match Running/ })
    .nth(1)
    .click();
  await drawer
    .getByRole("button", { name: "Link workout", exact: true })
    .click();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.requests.find((r: { path: string }) => r.path.endsWith("/reconcile"))
      .body.decisions[0].activityEntryId,
  ).toBe("second-run");
});

test("removing imported history clears the already viewed sleep score", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__health`, {
    headers: { Authorization: "Bearer local-e2e-token" },
  });
  await page.goto("/metrics");
  await page.getByRole("button", { name: "Health", exact: true }).click();
  await expect(
    page.getByTestId("sleep-metric").getByText("out of 100"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Manage Apple Health", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Disconnect Apple Health", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Disconnect and remove imported data",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Disconnect and remove imported data",
      exact: true,
    }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "View sleep score", exact: true })
    .click();
  await expect(
    page.getByTestId("sleep-metric").getByText("out of 100"),
  ).toBeHidden();
});

test("changing a match or amount stays a draft until the one final action", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__health`, {
    headers: { Authorization: "Bearer local-e2e-token" },
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Review workouts", exact: true })
    .click();
  const drawer = page.getByTestId("health-workout-drawer");
  await drawer.getByRole("button", { name: "Change workout amount" }).click();
  await expect(
    drawer.getByRole("button", { name: "Keep 5 kilometers" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/workout-amount.png" });
  await drawer
    .getByRole("button", { name: "Use 5 kilometers", exact: true })
    .click();
  await expect(drawer.getByText("Use 5 kilometers from Apple")).toBeVisible();
  await drawer.getByRole("button", { name: "Change workout match" }).click();
  await expect(drawer.getByLabel("Apple Watch workout: Running")).toBeVisible();
  await expect(drawer.getByText(/Same day as Watch/)).toBeVisible();
  await expect(
    drawer.getByText(
      "Choosing an activity below adds a separate log from this Watch workout.",
    ),
  ).toBeVisible();
  await expect(drawer.getByText("New log · 5 kilometers")).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/workout-choose.png" });
  await drawer.getByRole("button", { name: "Back to workout" }).click();
  await expect(drawer.getByText("Use 5 kilometers from Apple")).toBeVisible();
  const before = await (await request.get(`${API}/__state`)).json();
  expect(
    before.requests.filter((r: { path: string }) =>
      r.path.endsWith("/reconcile"),
    ),
  ).toHaveLength(0);
  await drawer
    .getByRole("button", { name: "Link workout", exact: true })
    .click();
  await expect(drawer).toBeHidden();
  const after = await (await request.get(`${API}/__state`)).json();
  expect(
    after.requests
      .filter((r: { path: string }) => r.path.endsWith("/reconcile"))
      .map((r: { body: unknown }) => r.body),
  ).toEqual([
    {
      decisions: [
        {
          healthWorkoutId: "health-run",
          action: "link_use_health",
          activityEntryId: "entry-run",
          shareHealthData: false,
        },
      ],
    },
  ]);
});
