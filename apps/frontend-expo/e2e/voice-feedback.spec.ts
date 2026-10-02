import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || "4317"}`;
const output = path.resolve("../../docs/reviews/voice-feedback");
const auth = { Authorization: "Bearer local-e2e-token" };
const member = {
  user: { id: "lia", name: "Lia Santos", username: "lia", picture: null },
  plan: { id: "lia-plan", goal: "train 4 times a week", emoji: "💪" },
  role: "MEMBER",
  joinedAt: "2026-08-01",
  pending: false,
  hasIntro: true,
  nudgedToday: true,
  week: { target: 4, done: 1, toGo: 3, daysLeft: 3, behind: true, isNew: false },
};
const circle = {
  id: "voice-feedback",
  name: "train 4 times a week",
  emoji: "💪",
  status: "ACTIVE",
  inviteCode: "invite",
  openToMatching: true,
  discoverable: true,
  place: "Lisbon",
  paceLabel: "4 a week",
  cap: 8,
  me: { role: "MEMBER", planId: "fitness", pending: false, hasIntro: true },
  members: [
    {
      ...member,
      user: { id: "test-user", name: "You", username: "you", picture: null },
      week: { ...member.week, done: 3, toGo: 1, behind: false },
    },
    member,
  ],
  togetherStreak: 0,
  recap: null,
};

// A fake microphone, so the real recorder runs in the browser.
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

for (const theme of ["LIGHT", "DARK"]) {
  test(`dictation asks if it was right, and a wrong language leads to the languages drawer in ${theme}`, async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);
    const feedback: any[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: auth,
      data: { themeMode: theme, spokenLanguages: [] },
    });
    await page.route("**/circles/**", async (route) => {
      const url = route.request().url();
      await route.fulfill({
        json: url.endsWith("/feed") ? { entries: [], introIds: [] } : circle,
      });
    });
    // What the old model heard for a short Portuguese "che, tás como?".
    await page.route("**/ai/transcribe", async (route) => {
      await route.fulfill({
        json: {
          text: "Сейчас ташком.",
          language: "ru",
          model: "openai/whisper-large-v3",
          success: true,
        },
      });
    });
    await page.route("**/ai/transcribe/feedback", async (route) => {
      feedback.push(route.request().postDataJSON());
      await route.fulfill({ json: { success: true } });
    });
    const dictate = async () => {
      await drawer.getByRole("button", { name: "Start voice input" }).click();
      await drawer.getByRole("button", { name: /^Stop dictation/ }).click();
      await expect(banner.getByText("Did we get that right?")).toBeVisible();
      await expect(
        drawer.getByRole("button", { name: "Start voice input" }),
      ).toBeVisible();
    };

    await page.goto("/circle/voice-feedback");
    await page.getByRole("button", { name: "Motivate Lia", exact: true }).click();
    const drawer = page.getByTestId("motivate-drawer");
    const banner = drawer.getByTestId("transcription-feedback");
    await expect(banner).toHaveCount(0);

    // Thumbs up: one tap, no transcript kept.
    await dictate();
    await expect(
      drawer.getByRole("textbox", { name: "Your message" }),
    ).toHaveValue("Сейчас ташком.");
    mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, `banner-${theme}.png`) });
    await banner.getByRole("button", { name: "Transcription is right" }).click();
    await expect(banner.getByText("Thanks, that helps.")).toBeVisible();
    expect(feedback).toEqual([
      { helpful: true, language: "ru", model: "openai/whisper-large-v3" },
    ]);
    await expect(banner).toHaveCount(0);

    // Thumbs down: why, then (wrong language) which languages.
    await dictate();
    await banner.getByRole("button", { name: "Transcription is wrong" }).click();
    const why = page.getByTestId("transcription-feedback-drawer");
    await expect(why.getByRole("heading", { name: "What went wrong?" })).toBeVisible();
    await expect(why.getByRole("button", { name: "Send" })).toBeDisabled();
    await why.getByRole("button", { name: "Wrong language" }).click();
    await why.getByRole("textbox", { name: "What did you say?" }).fill("che, tás como?");
    await page.screenshot({ path: path.join(output, `why-${theme}.png`) });
    await why.getByRole("button", { name: "Send" }).click();
    await expect.poll(() => feedback.length).toBe(2);
    expect(feedback[1]).toEqual({
      helpful: false,
      reason: "WRONG_LANGUAGE",
      comment: "che, tás como?",
      transcript: "Сейчас ташком.",
      language: "ru",
      model: "openai/whisper-large-v3",
    });

    const languages = page.getByTestId("languages-drawer");
    await expect(
      languages.getByRole("heading", { name: "Which languages do you speak?" }),
    ).toBeVisible();
    await languages.getByRole("button", { name: "Portuguese", exact: true }).click();
    await languages.getByRole("button", { name: "English", exact: true }).click();
    await expect(languages.getByText("Main", { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(output, `languages-${theme}.png`) });
    await expect
      .poll(async () => (await (await request.get(`${API}/users/user`, { headers: auth })).json()).spokenLanguages)
      .toEqual(["pt", "en"]);
    await languages.getByRole("button", { name: "Close", exact: true }).click();
    await expect(languages).toHaveCount(0);
    await expect(banner.getByText("Thanks, that helps.")).toBeVisible();

    // Settings shows the choice and opens the same drawer. (The wait lets the
    // saved-to-disk copy of the user catch up before the page reloads.)
    await page.waitForTimeout(1500);
    await page.goto("/settings");
    await page
      .getByRole("button", { name: "Languages · Portuguese and English" })
      .click();
    await expect(
      page.getByTestId("languages-drawer").getByText("Main", { exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(600); // the drawer finishes sliding in
    await page.screenshot({ path: path.join(output, `settings-${theme}.png`) });
    expect(errors).toEqual([]);
  });
}
