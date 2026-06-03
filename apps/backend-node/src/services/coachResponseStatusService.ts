import { logger } from "../utils/logger";
import { redisService } from "./redisService";

export type CoachResponseStatus =
  | "thinking"
  | "searching"
  | "drafting"
  | "error";

export interface CoachResponseState {
  chatId: string;
  userMessageId: string;
  status: CoachResponseStatus;
  startedAt: string;
  updatedAt: string;
  timeoutAt: string;
  errorMessage?: string;
}

const ACTIVE_TTL_SECONDS = 10 * 60;
const ERROR_TTL_SECONDS = 5 * 60;
const COACH_RESPONSE_TIMEOUT_MS = 120000;

const chatKey = (chatId: string) => `coach-response:chat:${chatId}`;
const messageKey = (userMessageId: string) =>
  `coach-response:message:${userMessageId}`;

class CoachResponseStatusService {
  async start(input: {
    chatId: string;
    userMessageId: string;
    status?: Exclude<CoachResponseStatus, "error">;
  }): Promise<void> {
    const now = new Date();
    const state: CoachResponseState = {
      chatId: input.chatId,
      userMessageId: input.userMessageId,
      status: input.status || "thinking",
      startedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      timeoutAt: new Date(now.getTime() + COACH_RESPONSE_TIMEOUT_MS).toISOString(),
    };

    await this.saveState(state, ACTIVE_TTL_SECONDS);
  }

  async updateStatus(input: {
    chatId: string;
    userMessageId: string;
    status: Exclude<CoachResponseStatus, "error">;
  }): Promise<void> {
    const existing = await this.getByMessage(input.userMessageId);
    const now = new Date().toISOString();
    const state: CoachResponseState = {
      chatId: input.chatId,
      userMessageId: input.userMessageId,
      startedAt: existing?.startedAt || now,
      timeoutAt:
        existing?.timeoutAt ||
        new Date(Date.now() + COACH_RESPONSE_TIMEOUT_MS).toISOString(),
      updatedAt: now,
      status: input.status,
    };

    await this.saveState(state, ACTIVE_TTL_SECONDS);
  }

  async markError(input: {
    chatId: string;
    userMessageId: string;
    errorMessage: string;
  }): Promise<void> {
    const existing = await this.getByMessage(input.userMessageId);
    const now = new Date().toISOString();
    const state: CoachResponseState = {
      chatId: input.chatId,
      userMessageId: input.userMessageId,
      startedAt: existing?.startedAt || now,
      timeoutAt: existing?.timeoutAt || now,
      updatedAt: now,
      status: "error",
      errorMessage: input.errorMessage,
    };

    await this.saveState(state, ERROR_TTL_SECONDS);
  }

  async complete(input: {
    chatId: string;
    userMessageId: string;
  }): Promise<void> {
    await this.withRedis(() =>
      redisService.del(chatKey(input.chatId), messageKey(input.userMessageId))
    );
  }

  async getByChat(chatId: string): Promise<CoachResponseState | null> {
    const userMessageId = await this.withRedis(() => redisService.get(chatKey(chatId)));
    if (!userMessageId) return null;
    return this.getByMessage(userMessageId);
  }

  private async getByMessage(
    userMessageId: string
  ): Promise<CoachResponseState | null> {
    const raw = await this.withRedis(() =>
      redisService.get(messageKey(userMessageId))
    );
    if (!raw) return null;

    try {
      return JSON.parse(raw) as CoachResponseState;
    } catch (error) {
      logger.warn(`Invalid coach response status in Redis: ${String(error)}`);
      return null;
    }
  }

  private async saveState(
    state: CoachResponseState,
    ttlSeconds: number
  ): Promise<void> {
    await this.withRedis(async () => {
      await redisService.setJson(messageKey(state.userMessageId), state, ttlSeconds);
      await redisService.set(chatKey(state.chatId), state.userMessageId, ttlSeconds);
    });
  }

  private async withRedis<T>(fn: () => Promise<T>): Promise<T | null> {
    if (!redisService.isConfigured) return null;

    try {
      return await fn();
    } catch {
      return null;
    }
  }
}

export const coachResponseStatusService = new CoachResponseStatusService();
