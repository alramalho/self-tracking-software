import { Index, Pinecone, RecordMetadata } from "@pinecone-database/pinecone";
import { logger } from "../utils/logger";

export interface SearchResult {
  id: string;
  score: number;
  fields: Record<string, any>;
}

export interface PineconeConfig {
  apiKey: string;
  indexName: string;
  indexHost: string;
}

export class PineconeService {
  private pc: Pinecone;
  private indexHost: string;
  private _namespace: Index<RecordMetadata>;

  constructor(
    config: PineconeConfig,
    private namespace: string
  ) {
    this.pc = new Pinecone({ apiKey: config.apiKey });
    this.indexHost = config.indexHost;
    this._namespace = this.pc.index(config.indexName, config.indexHost);
  }

  /**
   * Upsert a record to Pinecone with text embedding
   */
  async upsertRecord(
    text: string,
    identifier: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this._namespace.upsertRecords([
        { _id: identifier, chunk_text: text, ...metadata },
      ]);
      logger.info(
        `Upserted record ${identifier} to namespace ${this.namespace}`
      );
    } catch (error) {
      logger.error(`Failed to upsert record ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Query Pinecone for similar records
   */
  async query(
    queryText: string,
    topK: number = 10,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      const queryObj: any = {
        inputs: { text: queryText },
        topK: topK,
      };

      if (filter) {
        queryObj.filter = filter;
      }

      const result = await this._namespace.searchRecords({
        query: queryObj,
      });

      if (!result.result?.hits || result.result.hits.length === 0) {
        logger.info(
          `No results found for query "${queryText}" in namespace ${this.namespace}`
        );
        return [];
      }

      return result.result.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        fields: hit.fields,
      }));
    } catch (error) {
      logger.error(`Failed to query Pinecone for "${queryText}":`, error);
      throw error;
    }
  }

  /**
   * Delete a record from Pinecone
   */
  async deleteRecord(identifier: string): Promise<void> {
    try {
      await this.index.deleteOne({
        namespace: this.namespace,
        id: identifier,
      });
      logger.info(
        `Deleted record ${identifier} from namespace ${this.namespace}`
      );
    } catch (error) {
      logger.error(`Failed to delete record ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple records from Pinecone
   */
  async deleteRecords(identifiers: string[]): Promise<void> {
    try {
      await this.index.deleteMany({
        namespace: this.namespace,
        ids: identifiers,
      });
      logger.info(
        `Deleted ${identifiers.length} records from namespace ${this.namespace}`
      );
    } catch (error) {
      logger.error(`Failed to delete records:`, error);
      throw error;
    }
  }

  /**
   * Get statistics about the index
   */
  async getStats(): Promise<any> {
    try {
      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      logger.error("Failed to get index stats:", error);
      throw error;
    }
  }
}

// Create service instances for different namespaces
const pineconeConfig: PineconeConfig = {
  apiKey: process.env.PINECONE_API_KEY || "",
  indexName: process.env.PINECONE_INDEX_NAME || "",
  indexHost: process.env.PINECONE_INDEX_HOST || "",
};

// Validate configuration
if (!pineconeConfig.apiKey || !pineconeConfig.indexHost) {
  logger.warn(
    "Pinecone configuration missing. PINECONE_API_KEY and PINECONE_INDEX_HOST must be set."
  );
}

export const usersPineconeService = new PineconeService(
  pineconeConfig,
  "users"
);
export const plansPineconeService = new PineconeService(
  pineconeConfig,
  "plans"
);

export default PineconeService;
