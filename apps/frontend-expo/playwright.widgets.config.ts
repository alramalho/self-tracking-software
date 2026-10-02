import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "widgets.spec.ts",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  use: {
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    timezoneId: "Europe/Lisbon",
    baseURL: "http://127.0.0.1:8086",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
  },
  webServer: [
    {
      command: "E2E_API_PORT=4316 node --import tsx e2e/server.ts",
      url: "http://127.0.0.1:4316/__state",
    },
    {
      command:
        "EXPO_PUBLIC_E2E=true EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:4316 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 node node_modules/expo/bin/cli start --web --clear --port 8086",
      url: "http://127.0.0.1:8086",
      timeout: 120000,
    },
  ],
});
