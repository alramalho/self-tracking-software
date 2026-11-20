import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;

async function installFakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    const track = {
      stop() {},
      getSettings() {
        return { deviceId: "fake-microphone" };
      },
    };
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    };
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

for (const theme of ["DARK", "LIGHT"]) {
  test(`the round mic starts recording at once in ${theme}`, async ({
    page,
    request,
  }) => {
    await installFakeMicrophone(page);
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme, themeBaseColor: "AMBER" },
    });
    await page.goto("/add");

    const mic = page.getByTestId("voice-mic");
    await expect(mic).toBeVisible();
    await expect(mic).toHaveAccessibleName("Record voice note");
    await expect(page.getByText("Say what you did", { exact: false })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Log Running", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `test-results/voice-mic-${theme}.png` });

    await mic.click();
    const drawer = page.getByTestId("voice-log-drawer");
    await expect(drawer.getByTestId("voice-log-recording")).toBeVisible();
    await expect(drawer.getByText("Private until you save", { exact: true })).toHaveCount(0);
    await expect(
      drawer.getByRole("button", { name: "Stop recording", exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/voice-log-recording-${theme}.png` });

    await drawer.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(drawer).toHaveCount(0);
  });
}
