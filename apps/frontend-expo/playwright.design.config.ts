import { defineConfig, devices } from "@playwright/test";

// Same as the default config on separate ports, so it never reuses another worktree's servers.
const web = 8093;
const api = 4327;
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["outcome-onboarding.spec.ts", "onboarding-flow.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 8000 },
  use: { baseURL: `http://localhost:${web}`, channel: "chrome", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "mobile-web", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", timezoneId: "Europe/Berlin" } }],
  webServer: [
    { command: `E2E_API_PORT=${api} node --import tsx e2e/server.ts`, url: `http://127.0.0.1:${api}/__state`, reuseExistingServer: false },
    {
      command: `EXPO_PUBLIC_E2E=true EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:${api} EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 node node_modules/expo/bin/cli start --web --clear --port ${web}`,
      url: `http://localhost:${web}`,
      reuseExistingServer: false,
      timeout: 180000,
    },
  ],
});
