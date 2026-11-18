import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { enterWelcomeAge } from "./onboarding-welcome";

// "What did you cover?" on learning plans (18 Nov 2026): the course question in onboarding, the full-width
// button after a log, the coach's read with a suggested change, and the Coach tab's once-a-week question.
const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const headers = { Authorization: "Bearer local-e2e-token" };
const out = "../../../output/plan-polish";
const next = (page: Page, name = "Continue") => page.getByRole("button", { name, exact: true }).click();
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}.png` });
};

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

async function setup(request: any, theme: string, logged = true) {
  await request.post(`${API}/__reset`);
  await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "AMBER" } });
  await request.post(`${API}/__learning-coverage`, { headers, data: { logged } });
}

for (const theme of ["LIGHT", "DARK"]) {
  test(`learning goal: "Following a course or book?" before the days (${theme})`, async ({ page, request }) => {
    test.setTimeout(90000);
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "AMBER" } });
    await page.goto("/onboarding?preview=1");
    await enterWelcomeAge(page);
    await next(page);
    await page.getByRole("textbox", { name: "Your answer" }).fill("Play a complete song smoothly");
    await next(page);
    await expect(page.getByRole("heading", { name: "What can you play now?" })).toBeVisible();
    await page.getByRole("textbox", { name: "Your answer" }).fill("I know G, C, D and Em but change slowly. I practise twice a week for 15 minutes.");
    await next(page);
    await page.getByRole("button", { name: "Skip this question" }).click();
    await expect(page.getByRole("heading", { name: "Following a course or book?" })).toBeVisible();
    await shot(page, `course-question-${theme}`);
    await page.getByTestId("course-yes").click();
    await page.getByTestId("course-name").fill("Justin Guitar beginner course, module 3");
    await shot(page, `course-answer-${theme}`);
    await next(page);
    await page.getByRole("button", { name: "My own song" }).click();
    await expect(page.getByRole("heading", { name: "How many days would you prefer?" })).toBeVisible();
    await next(page, "Ask my coach");
    await expect(page.getByRole("heading", { name: "Choose your plan" })).toBeVisible();
    const state = await (await request.get(`${API}/__state`)).json();
    const options = state.requests.find((r: any) => r.path.endsWith("/design/options"));
    expect(options.body.asked).toContainEqual({ question: "Course or book they follow", answer: "Justin Guitar beginner course, module 3" });
  });

  test(`a running goal never asks about a course (${theme})`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, { headers, data: { themeMode: theme, themeBaseColor: "AMBER" } });
    await page.goto("/onboarding?preview=1");
    await enterWelcomeAge(page);
    await next(page);
    await page.getByRole("textbox", { name: "Your answer" }).fill("Finish my first half marathon");
    await next(page);
    await page.getByRole("textbox", { name: "Your answer" }).fill("Twice a week, about 5 km each. My easy 5 km takes 35–37 minutes.");
    await next(page);
    await page.getByRole("button", { name: "Skip this question" }).click();
    await page.getByRole("button", { name: "No target in mind" }).click();
    await expect(page.getByRole("heading", { name: "How many days would you prefer?" })).toBeVisible();
    await expect(page.getByText("Following a course or book?")).toHaveCount(0);
  });

  test(`after a log on a learning plan: full-width "What did you cover?", then the coach's suggestion (${theme})`, async ({ page, request }) => {
    test.setTimeout(60000);
    await installFakeMicrophone(page);
    await setup(request, theme, false);
    await page.goto("/add");
    await page.getByRole("button", { name: "Log Chinese", exact: true }).click();
    await page.getByLabel("Quantity", { exact: true }).fill("20");
    await page.getByRole("button", { name: "Log Activity", exact: true }).click();
    await page.getByRole("button", { name: "Log without photo", exact: true }).click();
    const button = page.getByTestId("log-celebration-share-more");
    await expect(button).toBeVisible({ timeout: 8000 });
    await expect(button).toHaveText(/What did you cover\?/);
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThan((page.viewportSize()!.width - 40) * 0.95);
    await page.waitForTimeout(2000);
    await shot(page, `coverage-celebration-${theme}`);
    await button.click();
    const drawer = page.getByTestId("voice-log-drawer");
    await expect(drawer.getByTestId("voice-log-follow-up-guide")).toContainText("What you covered");
    await shot(page, `coverage-recording-${theme}`);
    await drawer.getByRole("button", { name: "Stop recording", exact: true }).click();
    await expect(drawer.getByTestId("voice-log-review")).toBeVisible();
    await drawer.getByRole("button", { name: "Save voice note", exact: true }).click();
    await expect(drawer.getByTestId("voice-log-coverage")).toContainText("Thursday moves on to ordering food");
    await shot(page, `coverage-suggestion-${theme}`);
    await drawer.getByTestId("voice-log-coverage-review").click();
    await expect(page).toHaveURL(/messageId=coverage-message/);
  });

  test(`Coach tab asks once, only when nothing else waits; "Not now" closes it (${theme})`, async ({ page, request }) => {
    await setup(request, theme);
    await page.goto("/coach");
    const row = page.getByTestId("coach-item-coverage:scheduled");
    await expect(row).toBeVisible();
    await shot(page, `coverage-coach-tab-${theme}`);
    await row.click();
    await expect(page.getByRole("button", { name: /Tell (Helly|Oli)/ })).toBeVisible();
    await shot(page, `coverage-coach-drawer-${theme}`);
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(row).toHaveCount(0);
  });
}
