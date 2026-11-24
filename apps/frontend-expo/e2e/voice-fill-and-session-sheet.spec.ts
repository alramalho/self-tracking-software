import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };

async function installFakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    const track = { stop() {}, getSettings: () => ({ deviceId: "fake-microphone" }) };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
        enumerateDevices: async () => [{ kind: "audioinput", deviceId: "fake-microphone", label: "Fake microphone" }],
        addEventListener() {},
        removeEventListener() {},
      },
    });
    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      private listeners = new Map<string, Array<(event: any) => void>>();
      constructor(_stream: unknown, _options?: unknown) {}
      addEventListener(name: string, listener: (event: any) => void) {
        this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
      }
      start() {
        this.state = "recording";
        this.emit("start", {});
      }
      stop() {
        this.state = "inactive";
        this.emit("stop", {});
        this.emit("dataavailable", { data: new Blob(["fake voice recording"], { type: "audio/webm" }) });
      }
      private emit(name: string, event: any) {
        for (const listener of this.listeners.get(name) ?? []) listener(event);
      }
    }
    Object.assign(window, { MediaRecorder: FakeMediaRecorder });
  });
}

for (const theme of ["DARK", "LIGHT"]) {
  test(`saying it on the log sheet fills the amount, day and what it was about in ${theme}`, async ({ page, request }) => {
    await installFakeMicrophone(page);
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "AMBER" } });
    await page.goto("/add");
    await page.getByRole("button", { name: "Log Reading", exact: true }).click();
    const drawer = page.getByTestId("activity-logging-drawer");
    await drawer.getByTestId("voice-fill").click();
    await expect(drawer.getByTestId("voice-fill")).toHaveAccessibleName("Stop and fill in");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/voice-fill-recording-${theme}.png` });
    await drawer.getByTestId("voice-fill").click();

    await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("25");
    await expect(drawer.getByTestId("voice-fill-description")).toContainText("Chapter four of Dune");
    await expect(drawer.getByText("at 21:00")).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/voice-fill-filled-${theme}.png` });

    const state = await (await request.get(`${API}/__state`)).json();
    const preview = state.requests.find((entry: any) => entry.path === "/voice-logs/preview");
    expect(preview.body.focus_activity_id).toBe("read");

    // What it was about carries over as the caption of the log.
    await drawer.getByRole("button", { name: "Log Activity", exact: true }).click();
    await expect(drawer.locator("textarea, input").first()).toHaveValue("Chapter four of Dune");
  });

  test(`a planned session opens as a coach sheet over the week in ${theme}`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "AMBER" } });
    expect((await request.post(`${API}/__follow-through`, { headers, data: {} })).ok()).toBeTruthy();
    await page.goto("/plans?view=week");
    await page.goto("/session/session-check");
    const sheet = page.getByTestId("session-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("coach-note")).toContainText("Put on my shoes");
    await expect(sheet.getByText(/^Today · 18:00/)).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Log activity", exact: true })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/session-sheet-${theme}.png` });
    await sheet.getByRole("button", { name: "More session options" }).click();
    await expect(sheet.getByRole("button", { name: "Move this session" })).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/session-sheet-more-${theme}.png` });
  });
}
