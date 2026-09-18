import { test, expect } from "@playwright/test";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import path from "node:path";
const {
  backendEnv,
  frontendEnv,
  testEmail,
  testPassword,
  databaseUrl,
  root,
} = require("./environment.cjs");
const { PrismaClient } = require(
  path.join(root, "packages/prisma/generated/prisma"),
);
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

test.beforeAll(async () => {
  process.env.CLERK_SECRET_KEY = backendEnv.CLERK_SECRET_KEY;
  process.env.CLERK_PUBLISHABLE_KEY = frontendEnv.VITE_CLERK_PUBLISHABLE_KEY;
  await clerkSetup();
});
test.afterAll(async () => prisma.$disconnect());

test("real Clerk session logs, edits, renders grids and saves metrics through the unchanged backend", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/signin");
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: testEmail,
      password: testPassword,
    },
  });
  await page.goto("/");
  await expect(
    page.getByText("Friend's last activities", { exact: true }),
  ).toBeVisible();
  await page.getByTestId("nav-add").click();
  await page.getByRole("button", { name: "Log Running", exact: true }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Log Activity", exact: true }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Real backend Expo run");
  await page
    .getByRole("button", { name: "Skip Photo & Save", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    page.getByText("Log Your Metrics", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect
    .poll(() =>
      prisma.activityEntry.count({
        where: {
          userId: "expo-live-user",
          description: "Real backend Expo run",
          quantity: 7,
        },
      }),
    )
    .toBe(1);

  await page.getByTestId("nav-home").click();
  await page
    .getByRole("button", { name: "Expand Running 7 kilometers", exact: true })
    .click();
  const card = page
    .getByTestId("feed-card")
    .filter({ hasText: "Real backend Expo run" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect
    .poll(() =>
      prisma.activityEntry.count({
        where: {
          userId: "expo-live-user",
          description: "Real backend Expo run",
          quantity: 8,
        },
      }),
    )
    .toBe(1);

  await page.getByTestId("nav-plans").click();
  await page
    .getByRole("button", { name: "Exercise regularly", exact: true })
    .click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("grid-day-details")).toContainText("8");
  await page.screenshot({ path: info.outputPath("plans-real-api.png") });
  await page.getByTestId("nav-profile").click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page
      .getByTestId("profile-screen")
      .getByText("Real backend Expo run")
      .filter({ visible: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("profile-real-api.png") });

  await page.getByTestId("nav-metrics").click();
  await page.getByRole("button", { name: "Log Check-in", exact: true }).click();
  await page
    .getByRole("button", { name: "Energy rating 5", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mood rating 4", exact: true })
    .click();
  await page.getByLabel("Anything to add?").fill("Real API check-in");
  await page
    .getByRole("button", { name: "Save Check-in", exact: true })
    .click();
  await expect(page.getByText("Log Your Metrics", { exact: true })).toHaveCount(
    0,
  );
  await expect
    .poll(() =>
      prisma.metricEntry.count({
        where: { userId: "expo-live-user", description: "Real API check-in" },
      }),
    )
    .toBe(2);
  await page.screenshot({ path: info.outputPath("metrics-real-api.png") });
  await page.reload();
  await expect(page.getByText("Energy Trend", { exact: true })).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await prisma.user.findUnique({ where: { id: "expo-live-user" } }))
          ?.themeMode,
    )
    .toBe("DARK");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  for (const name of ["home", "add", "plans", "profile", "metrics"]) {
    await page.getByTestId(`nav-${name}`).click();
    if (name === "profile")
      await page.getByRole("button", { name: "Plans", exact: true }).click();
    await page.screenshot({
      path: info.outputPath(`${name}-dark-real-api.png`),
    });
    if (name === "plans") {
      if ((await page.getByTestId("plan-card").count()) === 0)
        await page
          .getByRole("button", { name: "Exercise regularly", exact: true })
          .click();
      await page.getByTestId("plan-card").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: info.outputPath("plan-grid-dark-real-api.png"),
      });
    }
  }
  expect(errors).toEqual([]);
});
