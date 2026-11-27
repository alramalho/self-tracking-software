import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { waitForCelebration } from "./celebration";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const quietGuitar = /^Practice guitar has gone quiet\./;

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
  test(`gone quiet → "Yes, log it" → say it → one card per day → where the week stands, in ${theme}`, async ({ page, request }) => {
    test.setTimeout(60000);
    await installFakeMicrophone(page);
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "AMBER" } });
    await request.post(`${API}/__plan-nudges`, { headers, data: {} });
    await page.goto("/coach");
    await page.getByRole("button", { name: quietGuitar }).click();
    await expect(page.getByText("Done some, just not logged?", { exact: true })).toBeVisible();
    await expect(page.getByText("What got in the way?", { exact: true })).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/catch-up-drawer-${theme}.png` });

    await page.getByTestId("coach-item-log").click();
    const drawer = page.getByTestId("voice-log-drawer");
    await expect(drawer.getByRole("heading", { name: "What did you do?" })).toBeVisible();
    await expect(drawer.getByTestId("voice-log-catch-up")).toContainText("Say what you did, and which days.");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/catch-up-recording-${theme}.png` });
    await drawer.getByRole("button", { name: "Stop recording", exact: true }).click();

    await expect(drawer.getByTestId("voice-log-review")).toBeVisible();
    await expect(drawer.getByText(/· Chords$/)).toBeVisible();
    await expect(drawer.getByText(/· Scales$/)).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/catch-up-review-${theme}.png` });
    await drawer.getByRole("button", { name: "Save voice note", exact: true }).click();

    await waitForCelebration(page);
    await expect(drawer.getByTestId("voice-log-standing")).toContainText(/this week/);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/catch-up-saved-${theme}.png` });

    const requests = (await (await request.get(`${API}/__state`)).json()).requests as any[];
    expect(requests.find((r) => r.path === "/voice-logs/preview").body.focus_activity_id).toBe("guitar");
    expect(requests.find((r) => r.path === "/voice-logs/commit").body.activities).toHaveLength(2);
    expect(requests.some((r) => r.path === "/follow-through/plans/guitar/caught-up")).toBe(true);
  });

  test(`"I've been doing it" in Talk to coach gets one line and Log it, in ${theme}`, async ({ page, request }) => {
    await installFakeMicrophone(page);
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "AMBER" } });
    await request.post(`${API}/__plan-nudges`, { headers, data: {} });
    await page.goto("/coach");
    await page.getByRole("button", { name: quietGuitar }).click();
    await page.getByTestId("coach-item-not-lately").click();
    await page.getByRole("button", { name: "Something else", exact: true }).click();
    await page.getByTestId("talk-answer").fill("I've been doing it");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByTestId("talk-say")).toHaveText("Good, let's get it logged.");
    await expect(page.getByRole("button", { name: "Later", exact: true })).toBeVisible();
    await expect(page.getByTestId("talk-answer")).toHaveCount(0);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/catch-up-talk-${theme}.png` });
    await page.getByRole("button", { name: "Log it", exact: true }).click();
    await expect(page.getByTestId("voice-log-drawer").getByRole("heading", { name: "What did you do?" })).toBeVisible();
  });
}

for (const theme of ["DARK", "LIGHT"]) {
  test(`"An hour today" in Talk to coach shows the session as a card, and Log it saves it in one tap, in ${theme}`, async ({ page, request }) => {
    test.setTimeout(60000);
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "AMBER" } });
    await request.post(`${API}/__plan-nudges`, { headers, data: {} });
    await page.goto("/coach");
    await page.getByRole("button", { name: quietGuitar }).click();
    await page.getByTestId("coach-item-not-lately").click();
    await page.getByRole("button", { name: "Something else", exact: true }).click();
    await page.getByTestId("talk-answer").fill("I've been practising, I did an hour today");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const card = page.getByTestId("talk-log-draft");
    await expect(card).toContainText("Guitar");
    await expect(card).toContainText("60 minutes · Today");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/talk-log-card-${theme}.png` });
    await page.getByRole("button", { name: "Log it", exact: true }).click();
    // Straight to saving: no recorder, no review.
    await waitForCelebration(page);
    await expect(page.getByTestId("voice-log-standing")).toContainText(/this week/);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/talk-log-saved-${theme}.png` });
    const requests = (await (await request.get(`${API}/__state`)).json()).requests as any[];
    expect(requests.some((r) => r.path === "/voice-logs/preview")).toBe(false);
    const commit = requests.find((r) => r.path === "/voice-logs/commit").body;
    expect(commit.activities).toEqual([expect.objectContaining({ activityId: "guitar", quantity: 60 })]);
  });

  test(`a fresh tattoo: the coach offers a pause, one tap pauses the plan and the screen says until when, in ${theme}`, async ({ page, request }) => {
    test.setTimeout(60000);
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "AMBER" } });
    await request.post(`${API}/__plan-nudges`, { headers, data: {} });
    await page.goto("/coach");
    await page.getByRole("button", { name: quietGuitar }).click();
    await page.getByTestId("coach-item-not-lately").click();
    await page.getByRole("button", { name: "Something else", exact: true }).click();
    await page.getByTestId("talk-answer").fill("I got a tattoo yesterday and I can't sweat for a few days.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByTestId("talk-detail")).toHaveText("I can pause the plan until Monday.");
    await expect(page.getByRole("button", { name: "Keep it running", exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/talk-pause-offer-${theme}.png` });
    await page.getByRole("button", { name: /^Pause until / }).click();
    await expect(page.getByTestId("talk-paused")).toContainText("Paused through");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `test-results/talk-paused-${theme}.png` });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.goto("/plans");
    await page.getByRole("button", { name: /Practice guitar/ }).first().click();
    await expect(page.getByText(/paused until /).first()).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `test-results/plan-paused-${theme}.png` });
  });
}
