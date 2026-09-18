import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const API = "http://127.0.0.1:4317";

async function installFakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    const track = { stop() {}, getSettings: () => ({ deviceId: "fake-microphone" }) };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
        enumerateDevices: async () => [
          { kind: "audioinput", deviceId: "fake-microphone", label: "Fake microphone" },
        ],
        addEventListener() {},
        removeEventListener() {},
      },
    });
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      state = "inactive";
      private listeners = new Map<string, Array<(event: any) => void>>();
      constructor(_stream: unknown, _options?: unknown) {}
      addEventListener(name: string, listener: (event: any) => void) {
        this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
      }
      start() { this.state = "recording"; this.emit("start", {}); }
      stop() {
        this.state = "inactive";
        this.emit("stop", {});
        this.emit("dataavailable", {
          data: new Blob(["fake voice recording"], { type: "audio/webm" }),
        });
      }
      private emit(name: string, event: any) {
        for (const listener of this.listeners.get(name) ?? []) listener(event);
      }
    }
    Object.assign(window, { MediaRecorder: FakeMediaRecorder });
  });
}

test("voice note survives navigation into plan onboarding and can be dismissed from Home", async ({
  page,
  request,
}) => {
  await installFakeMicrophone(page);
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, {
    headers: { Authorization: "Bearer local-e2e-token" },
    data: { themeMode: "LIGHT", themeBaseColor: "BLUE" },
  });
  await page.goto("/add");
  await page.evaluate(() => localStorage.clear());

  await page.getByTestId("log-voice-note-card").click();
  const drawer = page.getByTestId("voice-log-drawer");
  await drawer.getByRole("button", { name: "Start recording", exact: true }).click();
  await drawer.getByRole("button", { name: "Stop recording", exact: true }).click();
  await expect(drawer.getByTestId("voice-log-review")).toBeVisible();
  await drawer.getByRole("button", { name: "Close", exact: true }).click();

  await page.goto("/");
  const pending = page.getByTestId("pending-voice-note-card");
  await expect(pending).toBeVisible();
  await expect(pending.getByText("plan idea", { exact: false })).toBeVisible();
  await pending.getByRole("button", { name: "Review voice note", exact: true }).click();
  await expect(page.getByTestId("voice-log-plan-suggestion")).toBeVisible();
  await page.getByRole("button", { name: "Start a plan conversation", exact: true }).click();

  await expect(page).toHaveURL(/\/create-plan/);
  await expect(page.getByTestId("onboarding-answer")).toHaveValue(
    /I want to play guitar more regularly/,
  );
  await page.goto("/");
  await expect(page.getByTestId("pending-voice-note-card")).toBeVisible();
  await page
    .getByTestId("pending-voice-note-card")
    .getByRole("button", { name: "Dismiss voice note", exact: true })
    .click();
  await expect(page.getByTestId("pending-voice-note-card")).toBeHidden();
});
