import { z } from "zod/v4";
import { logger } from "../utils/logger";

const extractionSchema = z.object({
  status: z.enum(["sufficient", "insufficient"]),
  answer: z.string(),
  items: z.array(z.object({
    index: z.number().optional(),
    title: z.string(),
    duration: z.string().optional(),
    url: z.string().optional(),
    notes: z.string().optional(),
  })),
  facts: z.array(z.object({
    label: z.string(),
    value: z.string(),
    sourceText: z.string().optional(),
  })),
  missing: z.array(z.string()),
  nextAction: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});

type BrowserAgentInput = {
  task: string;
  startingUrls: string[];
  expectedData?: string;
  reason: string;
  maxSteps?: number;
};

type BrowserAgentOutput =
  | {
      success: true;
      status: "success" | "insufficient";
      answer: string;
      facts: Array<{ label: string; value: string; sourceText?: string }>;
      items: Array<{
        index?: number;
        title: string;
        duration?: string;
        url?: string;
        notes?: string;
      }>;
      missing: string[];
      confidence: "high" | "medium" | "low";
      sources: Array<{ url: string; title?: string }>;
      browserActionsSummary: string[];
    }
  | {
      success: false;
      status: "failed";
      error: string;
      browserActionsSummary: string[];
      sources: Array<{ url: string; title?: string }>;
    };

function formatBrowserAgentError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("402")) {
    return "Browserbase returned 402: browser minutes limit reached or billing is not enabled for this account.";
  }

  return message || "Browser automation failed";
}

function sanitizeExtraction(
  extraction: z.infer<typeof extractionSchema>
): z.infer<typeof extractionSchema> {
  const cleanOptionalString = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.toLowerCase() !== "null" ? trimmed : undefined;
  };

  return {
    ...extraction,
    items: extraction.items.map((item) => ({
      ...item,
      duration: cleanOptionalString(item.duration),
      notes: cleanOptionalString(item.notes),
      url:
        item.url && /^https?:\/\//i.test(item.url)
          ? item.url
          : undefined,
    })),
  };
}

async function importStagehand(): Promise<any> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)");
    const module = await dynamicImport("@browserbasehq/stagehand");
    return module.Stagehand;
  } catch (error) {
    throw new Error(
      `Browser automation is not configured: @browserbasehq/stagehand could not be loaded (${error instanceof Error ? error.message : String(error)})`
    );
  }
}

class BrowserAgentService {
  async browse(input: BrowserAgentInput): Promise<BrowserAgentOutput> {
    const apiKey = process.env.BROWSERBASE_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        status: "failed",
        error: "Browser automation is not configured: BROWSERBASE_API_KEY is missing.",
        browserActionsSummary: [],
        sources: [],
      };
    }

    const urls = input.startingUrls.map((url) => url.trim()).filter(Boolean).slice(0, 5);
    if (urls.length === 0) {
      return {
        success: false,
        status: "failed",
        error: "Browser automation needs at least one starting URL from the prior web search.",
        browserActionsSummary: [],
        sources: [],
      };
    }

    let stagehand: any | null = null;
    const browserActionsSummary: string[] = [];
    const sources: Array<{ url: string; title?: string }> = [];

    try {
      const Stagehand = await importStagehand();
      const stagehandOptions: Record<string, unknown> = {
        env: "BROWSERBASE",
        apiKey,
        selfHeal: true,
        serverCache: true,
        verbose: 0,
        domSettleTimeout: 45_000,
      };

      if (process.env.BROWSER_AGENT_MODEL) {
        stagehandOptions.model = process.env.BROWSER_AGENT_MODEL;
      }

      if (process.env.BROWSERBASE_PROJECT_ID) {
        stagehandOptions.browserbaseSessionCreateParams = {
          projectId: process.env.BROWSERBASE_PROJECT_ID,
        };
      }

      stagehand = new Stagehand(stagehandOptions);
      await stagehand.init();

      const page = stagehand.context.pages()[0] || await stagehand.context.newPage();
      const maxSteps = Math.min(Math.max(input.maxSteps ?? 8, 1), 12);
      let bestExtraction: z.infer<typeof extractionSchema> | null = null;

      for (const url of urls) {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        const title = await page.title().catch(() => undefined);
        sources.push({ url, title });
        browserActionsSummary.push(`Opened ${url}`);

        for (let step = 0; step < maxSteps; step++) {
          const extraction = sanitizeExtraction(await stagehand.extract(
            [
              "Find the data needed for this task using only the current page state.",
              `Task: ${input.task}`,
              `Expected data: ${input.expectedData || "Not specified"}`,
              `Why browser access was needed: ${input.reason}`,
              "If the visible page has enough information, set status to sufficient.",
              "When extracting playlists, courses, lessons, modules, or videos, put each entry in items with index, title, duration, and url when visible.",
              "Only put a URL in an item if the page exposes a real http(s) URL or href. Do not invent numeric URL fragments.",
              "Use facts for collection-level facts such as total count, course title, provider, or total duration.",
              "If not, set status to insufficient and provide one small nextAction, such as scrolling, expanding a section, opening a playlist panel, or clicking show more.",
              "Do not invent exact counts, durations, titles, or completion times.",
            ].join("\n"),
            extractionSchema,
            { timeout: 45_000 }
          ));

          bestExtraction = extraction;
          if (extraction.status === "sufficient") {
            return {
              success: true,
              status: "success",
              answer: extraction.answer,
              facts: extraction.facts,
              items: extraction.items,
              missing: extraction.missing,
              confidence: extraction.confidence,
              sources,
              browserActionsSummary,
            };
          }

          const nextAction =
            extraction.nextAction ||
            (step < maxSteps - 1 ? "scroll down to reveal more relevant content" : null);

          if (!nextAction || step === maxSteps - 1) {
            break;
          }

          browserActionsSummary.push(nextAction);
          await stagehand.act(nextAction, { timeout: 45_000 });
        }
      }

      if (bestExtraction) {
        return {
          success: true,
          status: "insufficient",
          answer: bestExtraction.answer,
          facts: bestExtraction.facts,
          items: bestExtraction.items,
          missing: bestExtraction.missing,
          confidence: bestExtraction.confidence,
          sources,
          browserActionsSummary,
        };
      }

      return {
        success: false,
        status: "failed",
        error: "Browser automation did not extract any page data.",
        browserActionsSummary,
        sources,
      };
    } catch (error) {
      logger.error("Browser automation failed:", error);
      return {
        success: false,
        status: "failed",
        error: formatBrowserAgentError(error),
        browserActionsSummary,
        sources,
      };
    } finally {
      if (stagehand) {
        await stagehand.close().catch((error: unknown) => {
          logger.warn(`Failed to close Browserbase session: ${String(error)}`);
        });
      }
    }
  }
}

export const browserAgentService = new BrowserAgentService();
