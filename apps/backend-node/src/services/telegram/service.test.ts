import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TelegramService } from "../telegramService";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    isAxiosError: (error: unknown) =>
      typeof error === "object" && error !== null && "isAxiosError" in error,
  },
}));

const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);

describe("TelegramService routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPost.mockResolvedValue({ data: { ok: true } });
  });

  it("keeps routine activity separate from dedicated operational alerts", async () => {
    const telegram = new TelegramService({
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_CHAT_IDS: "activity-chat",
      TELEGRAM_ALERT_CHAT_IDS: "alerts-chat",
    });

    await telegram.sendMessage("new user");
    await telegram.sendAlert("important bug");

    expect(mockedPost.mock.calls[0]?.[1]).toMatchObject({
      chat_id: "activity-chat",
    });
    expect(mockedPost.mock.calls[1]?.[1]).toMatchObject({
      chat_id: "alerts-chat",
      text: expect.stringContaining("tracking.so"),
    });
  });

  it("falls alerts back to the legacy singular activity destination", async () => {
    const telegram = new TelegramService({
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_CHAT_ID: "legacy-chat",
    });

    const report = await telegram.sendAlert("backend failed");

    expect(report).toMatchObject({
      channel: "alerts",
      configured: true,
      delivered: 1,
      failed: 0,
    });
    expect(mockedPost).toHaveBeenCalledWith(
      expect.stringContaining("/sendMessage"),
      expect.objectContaining({ chat_id: "legacy-chat" }),
      expect.anything(),
    );
  });

  it("retries rejected Markdown as plain text", async () => {
    mockedPost
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 400,
          data: { description: "Bad Request: can't parse entities" },
        },
      })
      .mockResolvedValueOnce({ data: { ok: true } });
    const telegram = new TelegramService({
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_ALERT_CHAT_IDS: "alerts-chat",
    });

    const report = await telegram.sendAlert("bug_with_underscores");

    expect(report.delivered).toBe(1);
    expect(mockedPost).toHaveBeenCalledTimes(2);
    expect(mockedPost.mock.calls[1]?.[1]).toMatchObject({
      chat_id: "alerts-chat",
      text: expect.stringContaining("bug_with_underscores"),
    });
  });

  it("reports an unreachable destination instead of claiming success", async () => {
    mockedPost.mockRejectedValue(new Error("network unavailable"));
    const telegram = new TelegramService({
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_ALERT_CHAT_IDS: "alerts-chat",
    });

    const report = await telegram.sendAlert("backend failed");

    expect(report).toMatchObject({ delivered: 0, failed: 1 });
  });

  it("checks configured destinations without returning full chat IDs", async () => {
    mockedGet.mockResolvedValue({
      data: { ok: true, result: { username: "trackingso_bot" } },
    });
    mockedPost.mockResolvedValue({
      data: {
        ok: true,
        result: { type: "group", title: "Important App Alerts" },
      },
    });
    const telegram = new TelegramService({
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_ALERT_CHAT_IDS: "-123456607",
    });

    const report = await telegram.checkConnection("alerts");

    expect(report).toMatchObject({
      botOk: true,
      botUsername: "trackingso_bot",
      dedicated: true,
      destinations: [
        {
          maskedChatId: "…6607",
          ok: true,
          type: "group",
          title: "Important App Alerts",
        },
      ],
    });
  });
});
