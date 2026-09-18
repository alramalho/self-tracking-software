import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/live",
  testMatch: "*.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 15000 },
  outputDir: "test-results-live",
  use: {
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    channel: "chrome",
    baseURL: "http://localhost:8084",
    timezoneId: "Europe/Berlin",
    // Authentication credentials and session tokens must not enter traces.
    trace: "off",
    actionTimeout: 15000,
    screenshot: "off",
  },
  webServer: [
    {
      command: "node e2e/live/start-backend.cjs",
      url: "http://127.0.0.1:4318/health",
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: "node e2e/live/start-expo.cjs",
      url: "http://localhost:8084",
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
