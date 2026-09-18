import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.spec.ts",
  testIgnore: "**/live/**",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://localhost:8083",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-web",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        timezoneId: "Europe/Berlin",
      },
    },
  ],
  webServer: [
    {
      command: "node --import tsx e2e/server.ts",
      url: "http://127.0.0.1:4317/__state",
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "EXPO_PUBLIC_E2E=true EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:4317 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 node node_modules/expo/bin/cli start --web --clear --port 8083",
      url: "http://localhost:8083",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
