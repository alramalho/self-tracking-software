import { openai } from "@ai-sdk/openai";
import Perplexity from "@perplexity-ai/perplexity_ai";
import { createGateway, generateText } from "ai";
import { logger } from "../utils/logger";

export interface WebSearchInput {
  query?: string;
  queries?: string[];
  maxResults?: number;
  maxTokensPerPage?: number;
}

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export type WebSearchOutput =
  | {
      success: true;
      query?: string;
      queries: string[];
      provider: "perplexity" | "openai";
      results: WebSearchResult[];
    }
  | {
      success: false;
      provider: "perplexity" | "openai";
      error: string;
      results: WebSearchResult[];
    };

class WebSearchService {
  private perplexity: Perplexity | null = null;

  constructor() {
    if (process.env.PERPLEXITY_API_KEY) {
      this.perplexity = new Perplexity({
        apiKey: process.env.PERPLEXITY_API_KEY,
      });
    } else {
      logger.warn("PERPLEXITY_API_KEY not set - Perplexity web search will be unavailable");
    }

    if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL) {
      logger.warn(
        "AI_GATEWAY_API_KEY not set and VERCEL env absent - OpenAI web search requires the Vercel AI Gateway key"
      );
    }
  }

  normalizeQueries(input: WebSearchInput): string[] {
    const queries = input.queries?.length ? input.queries : input.query ? [input.query] : [];
    return queries.map((query) => query.trim()).filter(Boolean);
  }

  async searchWithPerplexity(input: WebSearchInput): Promise<WebSearchOutput> {
    const queries = this.normalizeQueries(input);
    if (queries.length === 0) {
      return {
        success: false,
        provider: "perplexity",
        error: "Provide query or queries",
        results: [],
      };
    }

    if (!this.perplexity) {
      return {
        success: false,
        provider: "perplexity",
        error: "Perplexity web search is not available",
        results: [],
      };
    }

    try {
      const searchResults = await this.perplexity.search.create({
        query: queries,
        max_results: input.maxResults ?? (queries.length > 1 ? 8 : 5),
        max_tokens_per_page: input.maxTokensPerPage ?? 1536,
      });

      const results = searchResults.results.map((result) => ({
        title: result.title,
        snippet: result.snippet?.substring(0, 1200) || "",
        url: result.url,
      }));

      logger.info(
        `Perplexity web search for "${queries.join(" | ")}" returned ${results.length} results`
      );

      return {
        success: true,
        provider: "perplexity",
        query: queries.length === 1 ? queries[0] : undefined,
        queries,
        results,
      };
    } catch (error) {
      logger.error("Perplexity web search failed:", error);
      return {
        success: false,
        provider: "perplexity",
        error: error instanceof Error ? error.message : "Search failed",
        results: [],
      };
    }
  }

  async searchWithOpenAI(input: WebSearchInput): Promise<WebSearchOutput> {
    const queries = this.normalizeQueries(input);
    if (queries.length === 0) {
      return {
        success: false,
        provider: "openai",
        error: "Provide query or queries",
        results: [],
      };
    }

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey && !process.env.VERCEL) {
      return {
        success: false,
        provider: "openai",
        error:
          "OpenAI web search is unavailable: AI_GATEWAY_API_KEY is not set and VERCEL env is absent",
        results: [],
      };
    }

    try {
      const gateway = createGateway({ apiKey });
      const searchContextSize =
        (input.maxTokensPerPage || 0) >= 3000
          ? "high"
          : (input.maxTokensPerPage || 0) <= 768
            ? "low"
            : "medium";

      const result = await generateText({
        model: gateway.languageModel(process.env.OPENAI_WEB_SEARCH_MODEL || "openai/gpt-5.5"),
        prompt: [
          "Search the web for the following query or alternate queries.",
          "Return exact facts found from the web. Use the web_search tool when current or link-specific information is needed.",
          "Do not invent exact counts, titles, module names, URLs, or hours. Say when exact facts are not available.",
          "Queries:",
          ...queries.map((query, index) => `${index + 1}. ${query}`),
        ].join("\n"),
        tools: {
          web_search: openai.tools.webSearch({
            searchContextSize,
          }) as any,
        },
        toolChoice: "auto",
      });

      const outputText = result.text || "";
      const sourceResults = result.sources
        .filter((source) => source.sourceType === "url")
        .map((source) => ({
          title: source.title || source.url,
          snippet: outputText.substring(0, 1200),
          url: source.url,
        }));

      const toolSourceResults = result.toolResults.flatMap((toolResult) => {
        const output = toolResult.output as
          | {
              sources?: Array<
                | {
                    type: "url";
                    url: string;
                  }
                | {
                    type: "api";
                    name: string;
                  }
              >;
            }
          | undefined;

        return (output?.sources || [])
          .filter((source) => source.type === "url")
          .map((source) => ({
            title: source.url,
            snippet: outputText.substring(0, 1200),
            url: source.url,
          }));
      });

      const seenUrls = new Set<string>();
      const citedResults = [...sourceResults, ...toolSourceResults].filter((result) => {
        if (!result.url || seenUrls.has(result.url)) {
          return false;
        }
        seenUrls.add(result.url);
        return true;
      });

      const results =
        citedResults.length > 0
          ? citedResults
          : [
              {
                title: "OpenAI web search synthesis",
                snippet: outputText.substring(0, 1200),
                url: "",
              },
            ];

      logger.info(
        `OpenAI web search for "${queries.join(" | ")}" returned ${results.length} normalized results`
      );

      return {
        success: true,
        provider: "openai",
        query: queries.length === 1 ? queries[0] : undefined,
        queries,
        results,
      };
    } catch (error) {
      logger.error("OpenAI web search failed:", error);
      return {
        success: false,
        provider: "openai",
        error: error instanceof Error ? error.message : "Search failed",
        results: [],
      };
    }
  }
}

export const webSearchService = new WebSearchService();
