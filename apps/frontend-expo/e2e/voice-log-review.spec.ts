import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const API = "http://127.0.0.1:4317";

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
  test(`voice note review makes extracted items explicit before saving in ${theme}`, async ({
    page,
    request,
  }) => {
  await installFakeMicrophone(page);
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, {
    headers: { Authorization: "Bearer local-e2e-token" },
    data: { themeMode: theme, themeBaseColor: "BLUE" },
  });
  await page.goto("/add");

  await page.getByTestId("log-voice-note-card").click();
  const drawer = page.getByTestId("voice-log-drawer");
  await drawer.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(drawer.getByTestId("voice-log-recording")).toBeVisible();
  await drawer.getByRole("button", { name: "Stop recording", exact: true }).click();
  await expect(drawer.getByTestId("voice-log-review")).toBeVisible();
  await expect(drawer.getByText("What I heard", { exact: true })).toBeVisible();
  await expect(drawer.getByText("I went for a run and it felt good.", { exact: false }).first()).toBeVisible();
  await expect(drawer.getByText("Not included", { exact: true })).toBeVisible();
  await expect(drawer.getByTestId("voice-log-already-logged")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Running already logged", exact: true })).toBeDisabled();
  await expect(drawer.getByRole("button", { name: "Remove Guitar", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(drawer.getByRole("button", { name: "Remove Energy", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(drawer.getByTestId("voice-log-plan-suggestion")).toBeVisible();
  await page.screenshot({ path: `test-results/voice-log-review-${theme}.png` });

  await drawer.getByRole("button", { name: "Remove Guitar", exact: true }).click();
  await expect(drawer.getByRole("button", { name: "Include Guitar", exact: true })).toHaveAttribute("aria-pressed", "false");
  await drawer.getByRole("button", { name: "Save voice note", exact: true }).click();
  await expect(drawer.getByTestId("voice-log-committed")).toBeVisible();

  const state = await (await request.get(`${API}/__state`)).json();
  const preview = state.requests.find((entry: any) => entry.path === "/voice-logs/preview");
  const commit = state.requests.find((entry: any) => entry.path === "/voice-logs/commit");
  expect(preview.body.uploadedAudio.size).toBeGreaterThan(0);
  expect(commit.body.activities).toHaveLength(0);
  expect(commit.body.metrics).toHaveLength(1);
  expect(commit.body.note.text).toContain("six days a week");
  });
}
