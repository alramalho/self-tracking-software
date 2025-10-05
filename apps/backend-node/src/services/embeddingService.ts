import OpenAI from "openai";
import { logger } from "../utils/logger";

export class EmbeddingService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.warn("OPENAI_API_KEY not set - embedding generation will fail");
    }
    this.openai = new OpenAI({
      apiKey: apiKey || "",
    });
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      logger.error("Failed to generate embedding:", error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(
    texts: string[],
    model: string = "text-embedding-3-small"
  ): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: model,
        input: texts,
      });
      return response.data.map((d) => d.embedding);
    } catch (error) {
      logger.error("Failed to generate embeddings:", error);
      throw error;
    }
  }
}

export const embeddingService = new EmbeddingService();
export default embeddingService;
