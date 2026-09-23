import { defineConfig, devices } from "@playwright/test";
const apiPort = process.env.E2E_API_PORT || "4317";
const webPort = process.env.E2E_WEB_PORT || "8083";
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
    baseURL: `http://localhost:${webPort}`,
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
      command: `E2E_API_PORT=${apiPort} node --import tsx e2e/server.ts`,
      url: `http://127.0.0.1:${apiPort}/__state`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        `EXPO_PUBLIC_E2E=true EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:${apiPort} EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 node node_modules/expo/bin/cli start --web --clear --port ${webPort}`,
      url: `http://localhost:${webPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
