import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "widgets-pwa.spec.ts",
  workers: 1,
  use: {
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    baseURL: "http://127.0.0.1:5186",
    timezoneId: "Europe/Lisbon",
    reducedMotion: "reduce",
  },
  webServer: {
    command:
      "pnpm --dir ../frontend-vite exec vite --config vite.widgets.config.ts --host 127.0.0.1 --port 5186",
    url: "http://127.0.0.1:5186/e2e/widgets/",
    reuseExistingServer: true,
  },
});
