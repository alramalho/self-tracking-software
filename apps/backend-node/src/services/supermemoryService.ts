import Supermemory from "supermemory";
import { logger } from "../utils/logger";

class SupermemoryService {
  private client: Supermemory | null = null;

  constructor() {
    if (process.env.SUPERMEMORY_API_KEY) {
      this.client = new Supermemory();
    } else {
      logger.warn("SUPERMEMORY_API_KEY not set - long-term memory will be unavailable");
    }
  }

  async addMemory(userId: string, content: string, customId?: string) {
    if (!this.client) return;

    try {
      await this.client.add({
        content,
        containerTag: `user_${userId}`,
        ...(customId && { customId }),
      });
      logger.info(`Supermemory: stored memory for user ${userId}`);
    } catch (error) {
      logger.error("Supermemory add failed:", error);
    }
  }

  async deleteAllMemories(userId: string) {
    if (!this.client) return;

    try {
      await this.client.documents.deleteBulk({
        containerTags: [`user_${userId}`],
      });
      logger.info(`Supermemory: deleted all memories for user ${userId}`);
    } catch (error) {
      logger.error("Supermemory deleteBulk failed:", error);
    }
  }

  async getProfile(userId: string, query: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      const result = await this.client.profile({
        containerTag: `user_${userId}`,
        q: query,
      });

      const parts = [
        ...result.profile.static,
        ...result.profile.dynamic,
      ];

      if (result.searchResults?.results) {
        for (const r of result.searchResults.results) {
          if (r && typeof r === "object" && "memory" in r && typeof (r as any).memory === "string") {
            parts.push((r as any).memory);
          }
        }
      }

      const memoriesContext = parts.filter(Boolean).join("\n");
      if (memoriesContext) {
        logger.info(`Supermemory: retrieved profile for user ${userId} (${parts.length} items)`);
      }
      return memoriesContext || null;
    } catch (error) {
      logger.error("Supermemory profile failed:", error);
      return null;
    }
  }
}

export const supermemoryService = new SupermemoryService();
