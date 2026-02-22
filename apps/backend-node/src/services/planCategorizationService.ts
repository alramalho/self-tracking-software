import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod/v4";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { PLAN_CATEGORY_KEYS } from "../constants/planCategories";

const BATCH_SIZE = 10;

function getOpenRouter() {
  const headers: Record<string, string> = {};

  if (process.env.HELICONE_API_KEY) {
    headers["Helicone-Auth"] = `Bearer ${process.env.HELICONE_API_KEY}`;
  }
  if (process.env.NODE_ENV) {
    headers["Helicone-Property-Environment"] = process.env.NODE_ENV;
  }

  return createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseURL: process.env.HELICONE_API_KEY
      ? "https://openrouter.helicone.ai/api/v1"
      : undefined,
    headers,
  });
}

async function categorizePlans(
  plans: { id: string; goal: string }[]
): Promise<{ planId: string; category: string }[]> {
  const schema = z.object({
    results: z.array(
      z.object({
        planId: z.string(),
        category: z.enum(PLAN_CATEGORY_KEYS as [string, ...string[]]),
      })
    ),
  });

  const categoryList = PLAN_CATEGORY_KEYS.join(", ");
  const openrouter = getOpenRouter();

  const { object } = await generateObject({
    model: openrouter.chat("google/gemini-3-flash-preview"),
    schema,
    prompt: `Categorize each plan goal into exactly one category from: ${categoryList}

Plans:
${plans.map((p) => `- id: ${p.id} | goal: ${p.goal}`).join("\n")}

Return a result for every plan. Use "other" only if no category fits.`,
  });

  return object.results;
}

export async function runCategorizationJob(): Promise<{
  categorized: number;
  errors: number;
}> {
  let categorized = 0;
  let errors = 0;

  const plans = await prisma.plan.findMany({
    where: { goalChanged: true, deletedAt: null },
    select: { id: true, goal: true },
  });

  logger.info(`Plan categorization: ${plans.length} plans to categorize`);

  for (let i = 0; i < plans.length; i += BATCH_SIZE) {
    const batch = plans.slice(i, i + BATCH_SIZE);
    try {
      const results = await categorizePlans(batch);
      for (const { planId, category } of results) {
        await prisma.plan.update({
          where: { id: planId },
          data: { category, goalChanged: false },
        });
        categorized++;
      }
    } catch (err) {
      logger.error(`Plan categorization batch error:`, err);
      errors += batch.length;
    }
  }

  logger.info(
    `Plan categorization done: ${categorized} categorized, ${errors} errors`
  );
  return { categorized, errors };
}
