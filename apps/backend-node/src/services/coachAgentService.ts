import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { ToolLoopAgent, tool } from "ai";
import { z } from "zod/v4";
import { Plan, PlanSession, Activity, User, Reminder, RecurringType } from "@tsw/prisma";
import { prisma } from "../utils/prisma";
import { differenceInCalendarDays, format, endOfWeek, startOfWeek, addDays, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { activitySummarizer } from "./activitySummarizer";
import { toMidnightUTCDate } from "../utils/date";
import { logger } from "../utils/logger";
import { getCurrentUser } from "../utils/requestContext";
import Perplexity from "@perplexity-ai/perplexity_ai";
import dedent from "dedent";
import { TelegramService } from "./telegramService";
import { getCoachPersonalityConfig } from "./coachPersonalityService";

interface CoachAgentContext {
  user: User;
  plans: (Plan & { activities: Activity[]; sessions: PlanSession[] })[];
  reminders: Reminder[];
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  memoriesContext?: string | null;
  recentActivityContext?: string | null;
}

function isActiveCoachPlan(plan: Plan, now: Date = new Date()): boolean {
  return (
    !plan.deletedAt &&
    !plan.archivedAt &&
    !plan.isPaused &&
    (!plan.finishingDate || plan.finishingDate > now)
  );
}

export class CoachAgentService {
  private perplexity: Perplexity | null = null;
  private telegram = new TelegramService();

  constructor() {
    if (process.env.PERPLEXITY_API_KEY) {
      this.perplexity = new Perplexity({
        apiKey: process.env.PERPLEXITY_API_KEY,
      });
    } else {
      logger.warn(
        "PERPLEXITY_API_KEY not set - web search will be unavailable"
      );
    }
  }

  private getOpenRouterWithUserId(): OpenRouterProvider {
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

  /**
   * Create the coach agent with tools bound to the current context
   */
  createAgent(context: CoachAgentContext) {
    const {
      user,
      plans: allPlans,
      reminders,
      memoriesContext,
      recentActivityContext,
    } = context;
    const plans = allPlans.filter((plan) => isActiveCoachPlan(plan));
    const self = this;
    const coachPersonality = getCoachPersonalityConfig(user.coachPersonality);

    // Build plans context for the system prompt
    const plansContext = plans
      .map((plan) => {
        const activities = plan.activities
          .map((a) => `${a.emoji} ${a.title} (${a.measure}) [activityId: ${a.id}]`)
          .join(", ");

        // Group sessions by date for readability
        const sessionsByDate = plan.sessions.reduce((acc, s) => {
          const dateKey = format(new Date(s.date), "yyyy-MM-dd (EEE)");
          if (!acc[dateKey]) acc[dateKey] = [];
          const activity = plan.activities.find((a) => a.id === s.activityId);
          acc[dateKey].push(
            `${activity?.emoji || ""} ${activity?.title || "Unknown"}: ${s.quantity} ${activity?.measure || ""} [sessionId: ${s.id}]`
          );
          return acc;
        }, {} as Record<string, string[]>);

        const sessionsStr = Object.entries(sessionsByDate)
          .map(([date, sessions]) => `    ${date}: ${sessions.join(", ")}`)
          .join("\n");

        const isTimesPerWeek = plan.outlineType === "TIMES_PER_WEEK";
        return dedent`
          Plan: ${plan.goal} [planId: ${plan.id}]
          Emoji: ${plan.emoji || "none"}
          ${plan.goalReason ? `Why: ${plan.goalReason}` : ""}
          Coaching: ${plan.isCoached ? "coached" : "not coached yet"}
          Type: ${isTimesPerWeek ? `${plan.timesPerWeek}x per week (frequency-based, no scheduled sessions)` : "Specific scheduled sessions"}
          Activities: ${activities}
          ${isTimesPerWeek ? "" : `Sessions:\n          ${sessionsStr || "    No sessions scheduled"}`}
        `;
      })
      .join("\n\n");

    const today = new Date();
    const thisWeekEnd = endOfWeek(today, { weekStartsOn: 0 });

    // Build reminders context for the system prompt
    const activeReminders = reminders.filter((r) => r.status === "PENDING");
    const remindersContext = activeReminders.length > 0
      ? activeReminders
          .map((r) => {
            const triggerStr = format(new Date(r.triggerAt), "yyyy-MM-dd HH:mm");
            const recurringStr = r.isRecurring
              ? ` (${r.recurringType}${r.recurringDays.length > 0 ? `: ${r.recurringDays.join(", ")}` : ""})`
              : " (one-time)";
            return `- "${r.message}" at ${triggerStr}${recurringStr} [reminderId: ${r.id}]`;
          })
          .join("\n")
      : null;

    let nextCitationIndex = 1;

    const agent = new ToolLoopAgent({
      model: this.getOpenRouterWithUserId().chat("google/gemini-3-flash-preview"),
      temperature: 0.8,
      instructions: dedent`
        You are ${coachPersonality.displayName}, ${coachPersonality.title}, a knowledgeable fitness and habits coach that helps users achieve their fitness and habit goals through evidence-based coaching and plan adjustments.

        ${coachPersonality.systemPrompt}

        CONTEXT
        User: ${user.name || user.username}
        Today: ${format(today, "yyyy-MM-dd (EEEE)")}
        Current week ends: ${format(thisWeekEnd, "yyyy-MM-dd")} (Saturday)

        ${plansContext ? `USER'S PLANS:\n${plansContext}` : "No active plans."}

        ${recentActivityContext ? `RECENT ACTIVITY FACTS:\n${recentActivityContext}` : ""}

        ${remindersContext ? `USER'S REMINDERS:\n${remindersContext}` : "No active reminders."}

        ${memoriesContext ? `LONG-TERM MEMORY (key facts about this user):\n${memoriesContext}` : ""}

        GUIDELINES
        - Ask clarifying questions before making changes: current experience, constraints, things to avoid
        - Research first, then advise. Web search results override your assumptions
        - Be direct, concise, and realistic. If a goal is unrealistic given constraints, say so
        - Suggesting the user adjust their goal is better than setting them up to fail
        - If no plan is coached yet, treat that as setup, not an error. Ask whether the user wants to tighten an existing plan or create a new coached plan.
        - When a plan goal is vague or purely frequency-based, mention that plan by its exact goal text from USER'S PLANS so it can be linked in the UI.
        - If the user gives a concrete measurable goal, use proposePlanCreation for a new goal or proposePlanModification with update_plan for an existing plan.
        - Any capability not provided by the available tools is not available to you.
        - When saying the user logged, did, trained, or practiced something recently/lately, rely only on RECENT ACTIVITY FACTS or readActivities output. Active plans and long-term memory are not recent activity evidence.
        - If an activity only appears in a plan, describe it as a goal/planned activity, not something the user has logged.
        - "Recently" and "lately" mean inside the recent activity lookback unless the readActivities tool returns a different date range.
        - Use webSearch only when fresh outside knowledge materially changes the answer.
        - If you rely on a webSearch result, cite it inline with that result's citationLabel, like [1]. Cite only the sources you actually used.

        RULES
        - Never modify sessions or reminders without user confirmation
        - Sound like a sharp friend texting, not a report. Prefer plain words over coaching jargon.
        - Default to 1-2 short messages. Only use a third message when a tool proposal needs a separate confirmation.
        - Keep each message to 1-2 short sentences. Do not stack multiple critiques in one reply.
        - Make one point, then ask one natural next-step question if needed.
        - Avoid stiff phrases like "concrete, measurable outcome", "frequency alone is not a strategy", or "serious coached plan" unless the user used them first.
        - You MUST use the draftMessages tool to send your response. Never respond with plain text.
        - Each message should focus on one topic/thought. Use multiple messages only when covering distinct points.
        - No markdown headers (#). No numbered lists. Keep it conversational like texting.
        - Do not use em dashes. Use commas, periods, or parentheses instead.
        
      `,
      tools: {
        draftMessages: tool({
          description: "Send your response as chat messages. Always use this to reply.",
          inputSchema: z.object({
            messages: z.array(z.object({
              content: z.string().describe("A short chat message (1-2 sentences)"),
            })).min(1).max(3),
          }),
          execute: async ({ messages }) => ({ success: true, count: messages.length }),
        }),

        webSearch: tool({
          description:
            "Search the web for information about training, fitness, habits, health, or any topic relevant to helping the user achieve their goals. Use this to find evidence-based recommendations.",
          inputSchema: z.object({
            query: z
              .string()
              .describe("The search query to find relevant information"),
          }),
          execute: async ({ query }) => {
            if (!self.perplexity) {
              return {
                success: false as const,
                error: "Web search is not available",
                results: [] as Array<{ title: string; snippet: string; url: string }>,
              };
            }

            try {
              const searchResults = await self.perplexity.search.create({
                query: [query],
                max_results: 5,
                max_tokens_per_page: 512,
              });

              const results = searchResults.results.map((result) => {
                const citationIndex = nextCitationIndex++;
                return {
                  citationIndex,
                  citationLabel: `[${citationIndex}]`,
                  title: result.title,
                  snippet: result.snippet?.substring(0, 300) || "",
                  url: result.url,
                };
              });

              logger.info(
                `Web search for "${query}" returned ${results.length} results`
              );

              return {
                success: true as const,
                query,
                citationInstruction:
                  "If you use a result in your final answer, cite it inline with its citationLabel.",
                results,
              };
            } catch (error) {
              logger.error("Web search failed:", error);
              self.telegram.sendMessage(
                `🔴 Coach webSearch tool failed\nUser: ${user.username}\nQuery: ${query}\nError: ${error instanceof Error ? error.message : String(error)}`
              );
              return {
                success: false as const,
                error: "Search failed. Continue without search results.",
                results: [] as Array<{ title: string; snippet: string; url: string }>,
              };
            }
          },
        }),

        proposePlanModification: tool({
          description: dedent`
            Propose modifications to a user's plan sessions. The user will be able to accept or reject the proposal with one click.
            You can propose to:
            - Add new sessions (provide activityId, date, quantity, descriptiveGuide)
            - Update existing sessions (provide sessionId and fields to update)
            - Remove sessions (provide sessionId)
            - Archive a dormant plan (no extra fields)
            - Tighten plan setup (provide update_plan with a clearer goal, optional reason, optional frequency, and optional coaching flag)

            Use the planId, activityId, and sessionId values from the plan context above.
            IMPORTANT: Always provide a clear, short description of what the proposal does (e.g. "Archive gym for now", "Pause chess for next week", "Reduce gym to 2x/week").
            IMPORTANT: When adding sessions, always propose a COMPLETE week (Sun-Sat). Never propose a partial week update (e.g. just Monday-Wednesday). Always cover the full week schedule. Discuss the full week with the user before proposing.
          `,
          inputSchema: z.object({
            planId: z.string().describe("The ID of the plan to modify"),
            description: z
              .string()
              .describe(
                "Short human-readable description of the proposal (e.g. 'Pause chess for next week')"
              ),
            operations: z.array(
              z.union([
                z.object({
                  type: z.literal("add"),
                  activityId: z
                    .string()
                    .describe("The ID of the activity for this session"),
                  date: z
                    .string()
                    .describe("The date for the session (YYYY-MM-DD format)"),
                  quantity: z
                    .number()
                    .describe("The quantity/amount for this session"),
                  descriptiveGuide: z
                    .string()
                    .optional()
                    .describe("Optional description or guide for the session"),
                }),
                z.object({
                  type: z.literal("update"),
                  sessionId: z.string().describe("The ID of the session to update"),
                  date: z
                    .string()
                    .optional()
                    .describe("New date (YYYY-MM-DD format)"),
                  quantity: z.number().optional().describe("New quantity"),
                  descriptiveGuide: z
                    .string()
                    .optional()
                    .describe("New description"),
                }),
                z.object({
                  type: z.literal("remove"),
                  sessionId: z.string().describe("The ID of the session to remove"),
                }),
                z.object({
                  type: z.literal("archive"),
                }),
                z.object({
                  type: z.literal("update_plan"),
                  goal: z.string().optional().describe("Clearer measurable plan goal"),
                  goalReason: z.string().optional().nullable().describe("Why this plan matters to the user"),
                  outlineType: z.enum(["SPECIFIC", "TIMES_PER_WEEK"]).optional(),
                  timesPerWeek: z.number().positive().optional(),
                  isCoached: z.boolean().optional().describe("Set true when the user wants this plan coached"),
                }),
              ])
            ).min(1),
          }),
          execute: async ({ planId, description, operations }) => {
            if (operations.length === 0) {
              return {
                success: false,
                error: "This tool cannot be called with empty operations",
              };
            }

            if (
              operations.some((op) => op.type === "archive") &&
              operations.length > 1
            ) {
              return {
                success: false,
                error: "Archive must be proposed as a standalone operation",
              };
            }

            const setupOps = operations.filter((op) => op.type === "update_plan");
            if (setupOps.length > 1 || (setupOps.length === 1 && operations.length > 1)) {
              return {
                success: false,
                error: "Plan setup updates must be proposed as a standalone operation",
              };
            }

            const plan = plans.find((p) => p.id === planId);
            if (!plan) {
              return {
                success: false,
                error: `Plan ${planId} not found or doesn't belong to user`,
              };
            }

            const planActivityIds = new Set(plan.activities.map((a) => a.id));
            const invalidOps = operations.filter(
              (op) => op.type === "add" && !planActivityIds.has(op.activityId)
            );
            if (invalidOps.length > 0) {
              const validActivities = plan.activities
                .map((a) => `${a.emoji} ${a.title} [${a.id}]`)
                .join(", ");
              return {
                success: false,
                error: `Some operations reference activities not in this plan. Valid activities for "${plan.goal}": ${validActivities}`,
              };
            }

            const addOps = operations.filter((op) => op.type === "add");
            if (addOps.length > 0) {
              const dates = addOps.map((op) => parseISO(op.date));
              const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
              const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
              const weekSun = startOfWeek(minDate, { weekStartsOn: 0 });
              const weekSat = endOfWeek(minDate, { weekStartsOn: 0 });
              const allInSameWeek = dates.every((d) => d >= weekSun && d <= weekSat);

              if (!allInSameWeek) {
                return {
                  success: false,
                  error: `All proposed sessions must be within the same week (Sun-Sat).`,
                };
              }

              const spanDays = Math.round((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
              if (spanDays < 4) {
                return {
                  success: false,
                  error: `Proposal only covers ${format(minDate, "EEE MMM d")} to ${format(maxDate, "EEE MMM d")}. Plan modifications must be for a full week (${format(weekSun, "MMM d")} - ${format(weekSat, "MMM d")}). Discuss the complete week schedule with the user before proposing.`,
                };
              }
            }

            logger.info(
              `Plan modification proposed for ${planId}: "${description}" (${operations.length} operations)`
            );

            return {
              success: true,
              proposal: {
                planId,
                planGoal: plan.goal,
                planEmoji: plan.emoji,
                description,
                operations,
              },
            };
          },
        }),

        proposePlanCreation: tool({
          description: dedent`
            Propose creating a new coached plan. The user can accept or reject the proposal with one click.
            Use this only after the user gives a concrete goal or clearly asks for a new plan.
            Prefer measurable goals with a clear outcome, e.g. "Run 20 km under 2 hours" or "Reach 80 kg with low body fat".
          `,
          inputSchema: z.object({
            goal: z.string().describe("Short, concrete, measurable goal"),
            goalReason: z.string().optional().nullable().describe("Why the goal matters, if known"),
            emoji: z.string().optional().describe("Single emoji for the plan"),
            timesPerWeek: z.number().positive().optional().describe("Suggested weekly frequency, if known"),
            activities: z.array(z.object({
              title: z.string().describe("Activity title, e.g. Easy run"),
              measure: z.string().describe("Tracking unit, e.g. km, minutes, reps"),
              emoji: z.string().describe("Single emoji for the activity"),
              kind: z.string().optional().describe("Activity kind/category"),
            })).min(1).max(5).optional(),
            description: z.string().optional().describe("Short human-readable description"),
          }),
          execute: async ({ goal, goalReason, emoji, timesPerWeek, activities, description }) => {
            logger.info(
              `Plan creation proposed for ${user.id}: "${goal}" (${activities?.length || 0} activities)`
            );

            return {
              success: true,
              proposal: {
                goal,
                goalReason: goalReason || null,
                emoji: emoji || "🎯",
                timesPerWeek: timesPerWeek || null,
                activities: activities || [],
                description: description || `Create coached plan: ${goal}`,
              },
            };
          },
        }),

        proposeActivityLog: tool({
          description: dedent`
            Propose logging an activity entry for the user. The user will be able to accept or reject with one click.
            Match activities by name (case-insensitive exact match).
            Use the activity names from the plan context above.
          `,
          inputSchema: z.object({
            activityName: z.string().describe("The name of the activity to log (case-insensitive exact match)"),
            quantity: z.number().describe("The quantity/amount to log"),
            date: z.string().optional().describe("The date for the log (YYYY-MM-DD format). Defaults to today."),
            time: z.string().optional().describe("The time for the log (HH:mm:ss format, 24h). Defaults to 00:00:00. Use this when the user mentions a specific time."),
          }),
          execute: async ({ activityName, quantity, date, time }) => {
            const allActivities = plans.flatMap((p) => p.activities);
            const matchedActivity = allActivities.find(
              (a) => a.title.toLowerCase() === activityName.toLowerCase()
            );

            if (!matchedActivity) {
              return {
                success: false,
                error: `Activity "${activityName}" not found. Available activities: ${[...new Set(allActivities.map((a) => a.title))].join(", ")}`,
              };
            }

            const logDate = date || format(new Date(), "yyyy-MM-dd");
            const logTime = time || "00:00:00";

            logger.info(
              `Activity log proposed: ${matchedActivity.emoji} ${matchedActivity.title} x${quantity} on ${logDate} at ${logTime}`
            );

            return {
              success: true,
              proposal: {
                activityId: matchedActivity.id,
                activityName: matchedActivity.title,
                activityEmoji: matchedActivity.emoji,
                activityMeasure: matchedActivity.measure,
                quantity,
                date: logDate,
                time: logTime,
              },
            };
          },
        }),

        manageReminders: tool({
          description: dedent`
            Manage reminders for the user. You can:
            - Create new reminders (one-time or recurring)
            - Update existing reminders
            - Delete reminders

            For recurring reminders:
            - DAILY: triggers every day at the specified time
            - WEEKLY: triggers on specified days (e.g., ["MONDAY", "WEDNESDAY", "FRIDAY"])
            - MONTHLY: triggers on the same day each month

            Use the reminderId values from the reminders context above for update/delete.
            IMPORTANT: Always confirm with the user before creating, updating, or deleting reminders.
          `,
          inputSchema: z.object({
            operations: z.array(
              z.union([
                z.object({
                  type: z.literal("create"),
                  message: z.string().describe("The reminder message to show the user"),
                  triggerAt: z.string().describe("When to trigger (ISO 8601 format, e.g., 2024-01-15T09:00:00)"),
                  isRecurring: z.boolean().default(false).describe("Whether this is a recurring reminder"),
                  recurringType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional().describe("Type of recurrence"),
                  recurringDays: z.array(z.string()).optional().describe("Days for WEEKLY recurrence (e.g., ['MONDAY', 'WEDNESDAY'])"),
                }),
                z.object({
                  type: z.literal("update"),
                  reminderId: z.string().describe("The ID of the reminder to update"),
                  message: z.string().optional().describe("New message"),
                  triggerAt: z.string().optional().describe("New trigger time (ISO 8601 format)"),
                  isRecurring: z.boolean().optional().describe("Change recurrence setting"),
                  recurringType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional().describe("New recurrence type"),
                  recurringDays: z.array(z.string()).optional().describe("New days for WEEKLY recurrence"),
                }),
                z.object({
                  type: z.literal("delete"),
                  reminderId: z.string().describe("The ID of the reminder to delete"),
                }),
              ])
            ),
          }),
          execute: async ({ operations }) => {
            const changes: Array<{
              operation: string;
              reminderId?: string;
              message?: string;
              success: boolean;
              error?: string;
            }> = [];

            for (const op of operations) {
              try {
                if (op.type === "create") {
                  const newReminder = await prisma.reminder.create({
                    data: {
                      userId: user.id,
                      message: op.message,
                      triggerAt: new Date(op.triggerAt),
                      isRecurring: op.isRecurring || false,
                      recurringType: op.recurringType as RecurringType | undefined,
                      recurringDays: op.recurringDays || [],
                      status: "PENDING",
                    },
                  });

                  changes.push({
                    operation: "create",
                    reminderId: newReminder.id,
                    message: op.message,
                    success: true,
                  });

                  logger.info(`Created reminder ${newReminder.id} for user ${user.id}`);
                } else if (op.type === "update") {
                  // Verify the reminder belongs to the user
                  const existing = reminders.find((r) => r.id === op.reminderId);
                  if (!existing) {
                    changes.push({
                      operation: "update",
                      reminderId: op.reminderId,
                      success: false,
                      error: "Reminder not found or doesn't belong to user",
                    });
                    continue;
                  }

                  const updateData: Record<string, unknown> = {};
                  if (op.message !== undefined) updateData.message = op.message;
                  if (op.triggerAt !== undefined) updateData.triggerAt = new Date(op.triggerAt);
                  if (op.isRecurring !== undefined) updateData.isRecurring = op.isRecurring;
                  if (op.recurringType !== undefined) updateData.recurringType = op.recurringType;
                  if (op.recurringDays !== undefined) updateData.recurringDays = op.recurringDays;

                  await prisma.reminder.update({
                    where: { id: op.reminderId },
                    data: updateData,
                  });

                  changes.push({
                    operation: "update",
                    reminderId: op.reminderId,
                    success: true,
                  });

                  logger.info(`Updated reminder ${op.reminderId}`);
                } else if (op.type === "delete") {
                  const existing = reminders.find((r) => r.id === op.reminderId);
                  if (!existing) {
                    changes.push({
                      operation: "delete",
                      reminderId: op.reminderId,
                      success: false,
                      error: "Reminder not found or doesn't belong to user",
                    });
                    continue;
                  }

                  await prisma.reminder.update({
                    where: { id: op.reminderId },
                    data: { status: "CANCELLED" },
                  });

                  changes.push({
                    operation: "delete",
                    reminderId: op.reminderId,
                    success: true,
                  });

                  logger.info(`Deleted reminder ${op.reminderId}`);
                }
              } catch (error) {
                logger.error("Reminder operation failed:", error);
                changes.push({
                  operation: op.type,
                  reminderId: "reminderId" in op ? op.reminderId : undefined,
                  success: false,
                  error: error instanceof Error ? error.message : "Unknown error",
                });
              }
            }

            const successCount = changes.filter((c) => c.success).length;
            logger.info(
              `Reminder operations: ${successCount}/${operations.length} successful`
            );

            return {
              success: successCount === operations.length,
              changes,
            };
          },
        }),

        readActivities: tool({
          description:
            "Read user's activity history, metrics, and difficulty for a given number of past days. Returns a structured summary.",
          inputSchema: z.object({
            days: z
              .number()
              .describe(
                "Number of past days to look back (e.g. 7 for a week, 1 for today)"
              ),
          }),
          execute: async ({ days }) => {
            try {
              const now = new Date();
              const from = startOfDay(subDays(now, days));
              const to = endOfDay(now);

              const [activityEntries, metricEntries, plannedSessions] =
                await Promise.all([
                  prisma.activityEntry.findMany({
                    where: {
                      userId: user.id,
                      deletedAt: null,
                      datetime: { gte: from, lte: to },
                    },
                    include: {
                      activity: {
                        select: { title: true, emoji: true, measure: true },
                      },
                    },
                    orderBy: { datetime: "asc" },
                  }),
                  prisma.metricEntry.findMany({
                    where: {
                      userId: user.id,
                      createdAt: { gte: from, lte: to },
                    },
                    include: {
                      metric: { select: { title: true, emoji: true } },
                    },
                    orderBy: { createdAt: "asc" },
                  }),
                  prisma.planSession.findMany({
                    where: {
                      plan: {
                        userId: user.id,
                        deletedAt: null,
                        archivedAt: null,
                        isPaused: false,
                        OR: [
                          { finishingDate: null },
                          { finishingDate: { gt: now } },
                        ],
                      },
                      date: { gte: from, lte: to },
                    },
                    include: {
                      activity: {
                        select: { title: true, emoji: true, measure: true },
                      },
                    },
                    orderBy: { date: "asc" },
                  }),
                ]);

              const summary = await activitySummarizer.summarize({
                activityEntries,
                metricEntries,
                plannedSessions,
                dateRange: { from, to },
              });

              logger.info(
                `readActivities: ${days} days, ${activityEntries.length} entries, ${metricEntries.length} metrics, ${plannedSessions.length} sessions`
              );

              return {
                success: true as const,
                summary,
                daysQueried: days,
              };
            } catch (error) {
              logger.error("readActivities tool failed:", error);
              return {
                success: false as const,
                summary: "",
                daysQueried: days,
                error:
                  error instanceof Error ? error.message : "Unknown error",
              };
            }
          },
        }),
      },
    });

    return agent;
  }

  private async buildRecentActivityContext(
    user: User,
    now: Date,
    days = 30
  ): Promise<string> {
    const from = startOfDay(subDays(now, days));
    const entries = await prisma.activityEntry.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        activityId: { not: null },
        activity: { deletedAt: null },
        datetime: { gte: from, lte: now },
      },
      include: {
        activity: {
          select: { title: true, emoji: true, measure: true },
        },
      },
      orderBy: { datetime: "desc" },
      take: 20,
    });

    if (entries.length === 0) {
      return `Lookback: last ${days} days. No activity entries were logged in this window. Do not call any plan activity recent unless readActivities returns newer data.`;
    }

    const counts = new Map<string, { title: string; emoji: string; count: number }>();
    for (const entry of entries) {
      if (!entry.activity) continue;
      const key = entry.activity.title.toLowerCase();
      const current = counts.get(key) || {
        title: entry.activity.title,
        emoji: entry.activity.emoji,
        count: 0,
      };
      current.count += 1;
      counts.set(key, current);
    }

    const summary = Array.from(counts.values())
      .map((activity) => `${activity.emoji} ${activity.title}: ${activity.count}`)
      .join(", ");
    const lines = entries.slice(0, 12).map((entry) => {
      const activity = entry.activity;
      const daysAgo = differenceInCalendarDays(now, entry.datetime);
      const relativeLabel =
        daysAgo >= 0 && daysAgo < 7
          ? daysAgo === 0
            ? "today"
            : daysAgo === 1
              ? "yesterday"
              : `${format(entry.datetime, "EEE")}, ${daysAgo} days ago`
          : null;
      const dateLabel = relativeLabel
        ? `${format(entry.datetime, "yyyy-MM-dd")} (${relativeLabel})`
        : format(entry.datetime, "yyyy-MM-dd");
      return `- ${dateLabel}: ${activity?.emoji || ""} ${activity?.title || "Unknown"} (${entry.quantity} ${activity?.measure || "units"})`;
    });

    return [
      `Lookback: last ${days} days.`,
      `Logged activity counts: ${summary || "none"}.`,
      "Most recent entries:",
      ...lines,
    ].join("\n");
  }

  /**
   * Extract plan references from the message text
   * Looks for patterns like "plan goal" or emoji + text that match user's plans
   */
  private extractPlanReplacements(
    text: string,
    plans: Array<{ id: string; goal: string; emoji?: string | null }>
  ): Array<{ textToReplace: string; planGoal: string }> {
    const replacements: Array<{ textToReplace: string; planGoal: string }> = [];
    const usedRanges: Array<{ start: number; end: number }> = [];

    for (const plan of plans) {
      // Try to find the plan goal in the text (case insensitive)
      const goalLower = plan.goal.toLowerCase();
      const textLower = text.toLowerCase();

      // Look for the full goal
      let index = textLower.indexOf(goalLower);
      if (index !== -1) {
        const textToReplace = text.substring(index, index + plan.goal.length);
        // Check for overlap with existing replacements
        const overlaps = usedRanges.some(
          (r) => !(index + plan.goal.length <= r.start || index >= r.end)
        );
        if (!overlaps) {
          replacements.push({ textToReplace, planGoal: plan.goal });
          usedRanges.push({ start: index, end: index + plan.goal.length });
          continue;
        }
      }

      // Look for emoji + partial goal pattern like "♟️ daily chess plan"
      if (plan.emoji) {
        const emojiPattern = new RegExp(
          `${plan.emoji}\\s*[^.!?\\n]{0,50}`,
          "gi"
        );
        const match = text.match(emojiPattern);
        if (match && match[0]) {
          const foundIndex = text.indexOf(match[0]);
          const overlaps = usedRanges.some(
            (r) => !(foundIndex + match[0].length <= r.start || foundIndex >= r.end)
          );
          if (!overlaps) {
            replacements.push({ textToReplace: match[0], planGoal: plan.goal });
            usedRanges.push({ start: foundIndex, end: foundIndex + match[0].length });
          }
        }
      }
    }

    return replacements;
  }

  /**
   * Generate a coach response using the agent
   */
  async generateResponse(params: {
    user: User;
    message: string;
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
    plans: (Plan & { activities: Activity[]; sessions: PlanSession[] })[];
    reminders: Reminder[];
    memoriesContext?: string | null;
  }): Promise<{
    draftMessages: Array<{
      content: string;
      error?: boolean;
      planReplacements?: Array<{ textToReplace: string; planGoal: string }>;
      planProposals?: Array<{
        planId: string;
        planGoal: string;
        planEmoji: string | null;
        description: string;
        operations: unknown[];
        status: null;
      }>;
      planCreationProposals?: Array<{
        goal: string;
        goalReason: string | null;
        emoji: string | null;
        timesPerWeek: number | null;
        activities: Array<{ title: string; measure: string; emoji: string; kind?: string | null }>;
        description: string;
        status: null;
      }>;
      activityLogProposals?: Array<{
        activityId: string;
        activityName: string;
        activityEmoji: string;
        activityMeasure: string;
        quantity: number;
        date: string;
        status: null;
      }>;
      toolCalls?: Array<{ tool: string; args: unknown; result: unknown }>;
    }>;
    skipped?: boolean;
    skipReason?: string;
  }> {
    const { user, message, conversationHistory, plans, reminders, memoriesContext } = params;
    const activePlans = plans.filter((plan) => isActiveCoachPlan(plan));
    const recentActivityContext = await this.buildRecentActivityContext(
      user,
      new Date()
    );

    const agent = this.createAgent({
      user,
      plans: activePlans,
      reminders,
      conversationHistory,
      memoriesContext,
      recentActivityContext,
    });

    try {
      const result = await agent.generate({
        messages: [
          ...conversationHistory.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
          { role: "user" as const, content: message },
        ],
        onStepFinish: async ({ usage, toolCalls }) => {
          logger.info("Agent step completed", {
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            toolsUsed: toolCalls?.map((tc) => tc.toolName),
          });
        },
      });

      // Collect tool calls from all steps
      const allToolCalls: Array<{
        tool: string;
        args: unknown;
        result: unknown;
      }> = [];

      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            const toolResult = step.toolResults?.find(
              (tr) => tr.toolCallId === tc.toolCallId
            );
            allToolCalls.push({
              tool: tc.toolName,
              args: "args" in tc ? tc.args : undefined,
              result: toolResult && "output" in toolResult ? toolResult.output : undefined,
            });
          }
        }
      }

      // Extract draft messages from the draftMessages tool call
      const draftStep = result.steps.flatMap((s) => s.toolCalls || []).find((tc) => tc.toolName === "draftMessages");
      const rawDrafts: Array<{ content: string }> = draftStep
        ? (draftStep as any).input.messages
        : [{ content: result.text }]; // Fallback if tool wasn't called

      // Filter draftMessages out of visible tool calls
      const visibleToolCalls = allToolCalls.filter((tc) => tc.tool !== "draftMessages");

      // Extract plan proposals from tool calls
      const planProposals = visibleToolCalls
        .filter(
          (tc) =>
            tc.tool === "proposePlanModification" &&
            tc.result &&
            typeof tc.result === "object" &&
            (tc.result as any).success &&
            (tc.result as any).proposal
        )
        .map((tc) => ({
          ...(tc.result as any).proposal,
          status: null as null,
        }));

      // Extract activity log proposals from tool calls
      const activityLogProposals = visibleToolCalls
        .filter(
          (tc) =>
            tc.tool === "proposeActivityLog" &&
            tc.result &&
            typeof tc.result === "object" &&
            (tc.result as any).success &&
            (tc.result as any).proposal
        )
        .map((tc) => ({
          ...(tc.result as any).proposal,
          status: null as null,
        }));

      const planCreationProposals = visibleToolCalls
        .filter(
          (tc) =>
            tc.tool === "proposePlanCreation" &&
            tc.result &&
            typeof tc.result === "object" &&
            (tc.result as any).success &&
            (tc.result as any).proposal
        )
        .map((tc) => ({
          ...(tc.result as any).proposal,
          status: null as null,
        }));

      // Build draft messages with metadata distributed across them
      const plansList = activePlans.map((p) => ({ id: p.id, goal: p.goal, emoji: p.emoji }));
      const draftMessages = rawDrafts.map((draft, idx) => {
        const planReplacements = this.extractPlanReplacements(draft.content, plansList);
        const isFirst = idx === 0;
        const isLast = idx === rawDrafts.length - 1;

        return {
          content: draft.content,
          planReplacements: planReplacements.length > 0 ? planReplacements : undefined,
          // Plan proposals on the LAST message
          planProposals: isLast && planProposals.length > 0 ? planProposals : undefined,
          // Plan creation proposals on the LAST message
          planCreationProposals: isLast && planCreationProposals.length > 0 ? planCreationProposals : undefined,
          // Activity log proposals on the LAST message
          activityLogProposals: isLast && activityLogProposals.length > 0 ? activityLogProposals : undefined,
          // Tool calls on the FIRST message (excluding draftMessages)
          toolCalls: isFirst && visibleToolCalls.length > 0 ? visibleToolCalls : undefined,
        };
      });

      return { draftMessages };
    } catch (error) {
      logger.error("Coach agent error:", error);
      this.telegram.sendMessage(
        `🔴 Coach agent failed\nUser: ${user.username}\nMessage: ${message.substring(0, 100)}\nError: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        draftMessages: [{
          content: "Sorry, I ran into an issue processing your message. The team has been notified.",
          error: true,
        }],
      };
    }
  }
}

export const coachAgentService = new CoachAgentService();
