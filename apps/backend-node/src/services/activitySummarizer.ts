import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { format } from "date-fns";
import { logger } from "../utils/logger";
import { getCurrentUser } from "../utils/requestContext";

interface SummarizeInput {
  activityEntries: Array<{
    datetime: Date;
    quantity: number;
    difficulty?: string | null;
    activity?: { title: string; emoji: string; measure: string } | null;
  }>;
  metricEntries: Array<{
    createdAt: Date;
    rating: number;
    metric?: { title: string; emoji: string } | null;
  }>;
  plannedSessions: Array<{
    date: Date;
    quantity: number;
    activity: { title: string; emoji: string; measure: string };
  }>;
  dateRange: { from: Date; to: Date };
}

class ActivitySummarizer {
  private getOpenRouter(): OpenRouterProvider {
    const user = getCurrentUser();

    const headers: Record<string, string> = {
      "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    };

    if (user?.id) {
      headers["Helicone-User-Id"] = user.id;
    }
    if (user?.username) {
      headers["Helicone-Property-Username"] = user.username;
    }
    if (process.env.NODE_ENV) {
      headers["Helicone-Property-Environment"] = process.env.NODE_ENV;
    }

    return createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: "https://openrouter.helicone.ai/api/v1",
      headers,
    });
  }

  async summarize(input: SummarizeInput): Promise<string> {
    const { activityEntries, metricEntries, plannedSessions, dateRange } =
      input;

    const fromStr = format(dateRange.from, "yyyy-MM-dd");
    const toStr = format(dateRange.to, "yyyy-MM-dd");

    // Build raw data text for the LLM
    const parts: string[] = [];

    // Planned sessions grouped by date
    const sessionsByDate: Record<string, string[]> = {};
    for (const s of plannedSessions) {
      const dateKey = format(new Date(s.date), "yyyy-MM-dd (EEE)");
      if (!sessionsByDate[dateKey]) sessionsByDate[dateKey] = [];
      sessionsByDate[dateKey].push(
        `${s.activity.emoji} ${s.activity.title}: ${s.quantity} ${s.activity.measure}`
      );
    }
    if (Object.keys(sessionsByDate).length > 0) {
      parts.push(
        "PLANNED SESSIONS:\n" +
          Object.entries(sessionsByDate)
            .map(([date, sessions]) => `  ${date}: ${sessions.join(", ")}`)
            .join("\n")
      );
    } else {
      parts.push("PLANNED SESSIONS: None scheduled");
    }

    // Completed activities grouped by date
    const entriesByDate: Record<string, string[]> = {};
    const difficultiesByDate: Record<string, string[]> = {};
    for (const e of activityEntries) {
      const dateKey = format(new Date(e.datetime), "yyyy-MM-dd (EEE)");
      if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];
      const actTitle = e.activity
        ? `${e.activity.emoji} ${e.activity.title}`
        : "Unknown";
      const actMeasure = e.activity?.measure || "";
      entriesByDate[dateKey].push(`${actTitle}: ${e.quantity} ${actMeasure}`);
      if (e.difficulty) {
        if (!difficultiesByDate[dateKey]) difficultiesByDate[dateKey] = [];
        difficultiesByDate[dateKey].push(`${actTitle}: ${e.difficulty}`);
      }
    }
    if (Object.keys(entriesByDate).length > 0) {
      parts.push(
        "COMPLETED ACTIVITIES:\n" +
          Object.entries(entriesByDate)
            .map(([date, entries]) => `  ${date}: ${entries.join(", ")}`)
            .join("\n")
      );
    } else {
      parts.push("COMPLETED ACTIVITIES: None recorded");
    }

    // Difficulty reports
    if (Object.keys(difficultiesByDate).length > 0) {
      parts.push(
        "DIFFICULTY REPORTS:\n" +
          Object.entries(difficultiesByDate)
            .map(([date, entries]) => `  ${date}: ${entries.join(", ")}`)
            .join("\n")
      );
    } else {
      parts.push("DIFFICULTY REPORTS: No difficulty reported");
    }

    // Metric entries grouped by date
    const metricsByDate: Record<string, string[]> = {};
    for (const m of metricEntries) {
      const dateKey = format(new Date(m.createdAt), "yyyy-MM-dd (EEE)");
      if (!metricsByDate[dateKey]) metricsByDate[dateKey] = [];
      const metricTitle = m.metric
        ? `${m.metric.emoji} ${m.metric.title}`
        : "Unknown";
      metricsByDate[dateKey].push(`${metricTitle}: ${m.rating}/10`);
    }
    if (Object.keys(metricsByDate).length > 0) {
      parts.push(
        "METRIC RECORDINGS:\n" +
          Object.entries(metricsByDate)
            .map(([date, entries]) => `  ${date}: ${entries.join(", ")}`)
            .join("\n")
      );
    } else {
      parts.push("METRIC RECORDINGS: No metrics recorded");
    }

    const rawData = parts.join("\n\n");

    try {
      const openRouter = this.getOpenRouter();
      const result = await generateText({
        model: openRouter.chat("google/gemini-3-flash-preview"),
        system: `You are a data summarizer. Given raw user activity tracking data for a date range, produce a concise plain text summary covering:
1. Activities completed vs planned (per activity, grouped by day)
2. Difficulty reports (explicitly state "no difficulty reported" if none)
3. Metric recordings (explicitly state "no metrics recorded" if none)
4. Overall adherence/consistency assessment

Be factual and concise. Use bullet points. Do not give advice — just summarize the data.`,
        prompt: `Summarize this user's activity data from ${fromStr} to ${toStr}:\n\n${rawData}`,
        temperature: 0.2,
      });

      return result.text;
    } catch (error) {
      logger.error("Activity summarizer LLM call failed:", error);
      // Fallback: return raw data as-is
      return `Activity data from ${fromStr} to ${toStr}:\n\n${rawData}`;
    }
  }
}

export const activitySummarizer = new ActivitySummarizer();
