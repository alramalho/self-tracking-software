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
  test(`Share more after a log adds how it felt and what it was about in ${theme}`, async ({ page, request }) => {
    test.setTimeout(60000);
    await installFakeMicrophone(page);
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "BLUE" } });
    await page.goto("/add");
    await page.getByRole("button", { name: "Log Running", exact: true }).click();
    await page.getByLabel("Quantity", { exact: true }).fill("5");
    await page.getByRole("button", { name: "Log Activity", exact: true }).click();
    await page.getByRole("button", { name: "Log without photo", exact: true }).click();

    const shareMore = page.getByTestId("log-celebration-share-more");
    await expect(shareMore).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `test-results/share-more-celebration-${theme}.png` });
    await shareMore.click();

    const drawer = page.getByTestId("voice-log-drawer");
    await expect(drawer.getByTestId("voice-log-recording")).toBeVisible();
    await expect(drawer.getByTestId("voice-log-follow-up-guide")).toContainText("How it felt");
    await expect(drawer.getByTestId("voice-log-follow-up-guide")).toContainText("What it was about");
    await expect(drawer.getByTestId("voice-log-follow-up-guide")).toContainText("Anything else");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/share-more-recording-${theme}.png` });
    await drawer.getByRole("button", { name: "Stop recording", exact: true }).click();

    await expect(drawer.getByTestId("voice-log-review")).toBeVisible();
    await expect(drawer.getByText("Hill repeats along the river · Effort: hard · added to today's log", { exact: false })).toBeVisible();
    await expect(drawer.getByTestId("voice-log-already-logged")).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/share-more-review-${theme}.png` });
    await drawer.getByRole("button", { name: "Save voice note", exact: true }).click();
    await expect(drawer.getByTestId("voice-log-committed")).toBeVisible();
    // One follow-up per log.
    await expect(drawer.getByTestId("voice-log-share-more")).toHaveCount(0);

    const state = await (await request.get(`${API}/__state`)).json();
    const preview = state.requests.find((entry: any) => entry.path === "/voice-logs/preview");
    const commit = state.requests.find((entry: any) => entry.path === "/voice-logs/commit");
    expect(JSON.parse(preview.body.follow_up_context).logged[0]).toMatchObject({ activityId: "run", quantity: 5 });
    expect(commit.body.activities).toEqual([
      expect.objectContaining({ activityId: "run", quantity: 5, detailsOnly: true, difficulty: "hard" }),
    ]);
    expect(commit.body.metrics).toEqual([expect.objectContaining({ metricId: "energy", rating: 5 })]);
  });
}
