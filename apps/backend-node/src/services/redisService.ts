import Redis from "ioredis";
import { logger } from "../utils/logger";

const DEFAULT_REDIS_URL =
  process.env.NODE_ENV === "production"
    ? "redis://redis:6379"
    : "redis://127.0.0.1:6379";

class RedisService {
  private client: Redis | null = null;
  private warnedUnavailable = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || DEFAULT_REDIS_URL;

    this.client = new Redis(redisUrl, {
      connectTimeout: 1000,
      commandTimeout: 2000,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 100, 500)),
    });

    this.client.on("error", (error) => {
      if (this.warnedUnavailable) return;
      this.warnedUnavailable = true;
      logger.warn(`Redis unavailable: ${error.message}`);
    });
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async get(key: string): Promise<string | null> {
    return this.withRedis((client) => client.get(key));
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number
  ): Promise<void> {
    await this.withRedis((client) =>
      client.set(key, JSON.stringify(value), "EX", ttlSeconds)
    );
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.withRedis((client) => client.set(key, value, "EX", ttlSeconds));
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.withRedis((client) => client.del(...keys));
  }

  async disconnect(): Promise<void> {
    this.client?.disconnect();
  }

  private async withRedis<T>(
    fn: (client: Redis) => Promise<T>
  ): Promise<T | null> {
    if (!this.client) return null;

    try {
      if (this.client.status === "wait") {
        await this.client.connect();
      }
      return await fn(this.client);
    } catch (error) {
      if (!this.warnedUnavailable) {
        this.warnedUnavailable = true;
        logger.warn(
          `Redis unavailable: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      return null;
    }
  }
}

export const redisService = new RedisService();
