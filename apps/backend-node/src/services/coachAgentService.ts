import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { ToolLoopAgent, tool } from "ai";
import { z } from "zod/v4";
import { Plan, PlanSession, Activity, User, Reminder, RecurringType } from "@tsw/prisma";
import { prisma } from "../utils/prisma";
import { format, endOfWeek } from "date-fns";
import { toMidnightUTCDate } from "../utils/date";
import { logger } from "../utils/logger";
import { getCurrentUser } from "../utils/requestContext";
import Perplexity from "@perplexity-ai/perplexity_ai";
import dedent from "dedent";

interface CoachAgentContext {
  user: User;
  plans: (Plan & { activities: Activity[]; sessions: PlanSession[] })[];
  reminders: Reminder[];
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

export class CoachAgentService {
  private perplexity: Perplexity | null = null;

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
    const { user, plans, reminders } = context;
    const self = this;

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

        return dedent`
          Plan: ${plan.emoji || ""} ${plan.goal} [planId: ${plan.id}]
          Activities: ${activities}
          Sessions:
          ${sessionsStr || "    No sessions scheduled"}
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

    const agent = new ToolLoopAgent({
      model: this.getOpenRouterWithUserId().chat("anthropic/claude-4.5-sonnet"),
      instructions: dedent`
        You are a knowledgeable fitness and habits coach that helps users achieve their fitness and habit goals through evidence-based coaching and plan adjustments.

        CONTEXT
        User: ${user.name || user.username}
        Today: ${format(today, "yyyy-MM-dd (EEEE)")}
        Current week ends: ${format(thisWeekEnd, "yyyy-MM-dd")} (Saturday)

        ${plansContext ? `USER'S PLANS:\n${plansContext}` : "No active plans."}

        ${remindersContext ? `USER'S REMINDERS:\n${remindersContext}` : "No active reminders."}

        GUIDELINES
        - Ask clarifying questions before making changes: current experience, constraints, things to avoid
        - Research first, then advise. Web search results override your assumptions
        - Be direct, succint and realistic. If a goal is unrealistic given constraints, say so
        - Suggesting the user adjust their goal is better than setting them up to fail

        RULES
        - Never modify sessions or reminders without user confirmation
        - Keep responses concise
      `,
      tools: {
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

              const results = searchResults.results.map((result) => ({
                title: result.title,
                snippet: result.snippet?.substring(0, 300) || "",
                url: result.url,
              }));

              logger.info(
                `Web search for "${query}" returned ${results.length} results`
              );

              return {
                success: true as const,
                query,
                results,
              };
            } catch (error) {
              logger.error("Web search failed:", error);
              return {
                success: false as const,
                error: "Search failed",
                results: [] as Array<{ title: string; snippet: string; url: string }>,
              };
            }
          },
        }),

        adaptPlanSessions: tool({
          description: dedent`
            Modify sessions for a user's plan. You can:
            - Add new sessions (provide activityId, date, quantity, descriptiveGuide)
            - Update existing sessions (provide sessionId and fields to update)
            - Remove sessions (provide sessionId)

            Use the planId, activityId, and sessionId values from the plan context above.
          `,
          inputSchema: z.object({
            planId: z.string().describe("The ID of the plan to modify"),
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
              ])
            ),
          }),
          execute: async ({ planId, operations }) => {
            // Verify the plan belongs to the user
            const plan = plans.find((p) => p.id === planId);
            if (!plan) {
              return {
                success: false,
                error: `Plan ${planId} not found or doesn't belong to user`,
                changes: [] as Array<{
                  operation: string;
                  sessionId?: string;
                  success: boolean;
                  error?: string;
                }>,
              };
            }

            const changes: Array<{
              operation: string;
              sessionId?: string;
              success: boolean;
              error?: string;
            }> = [];

            for (const op of operations) {
              try {
                if (op.type === "add") {
                  const sessionDate = new Date(op.date);

                  // Validate activity belongs to the plan
                  const activity = plan.activities.find(
                    (a) => a.id === op.activityId
                  );
                  if (!activity) {
                    changes.push({
                      operation: "add",
                      success: false,
                      error: `Activity ${op.activityId} not found in plan`,
                    });
                    continue;
                  }

                  const newSession = await prisma.planSession.create({
                    data: {
                      planId,
                      activityId: op.activityId,
                      date: toMidnightUTCDate(sessionDate),
                      quantity: op.quantity,
                      descriptiveGuide: op.descriptiveGuide || "",
                      isCoachSuggested: true,
                    },
                  });

                  changes.push({
                    operation: "add",
                    sessionId: newSession.id,
                    success: true,
                  });
                } else if (op.type === "update") {
                  // Find the session
                  const session = plan.sessions.find(
                    (s) => s.id === op.sessionId
                  );
                  if (!session) {
                    changes.push({
                      operation: "update",
                      sessionId: op.sessionId,
                      success: false,
                      error: "Session not found",
                    });
                    continue;
                  }

                  const updateData: Record<string, unknown> = {};
                  if (op.date) updateData.date = toMidnightUTCDate(new Date(op.date));
                  if (op.quantity !== undefined) updateData.quantity = op.quantity;
                  if (op.descriptiveGuide !== undefined)
                    updateData.descriptiveGuide = op.descriptiveGuide;

                  await prisma.planSession.update({
                    where: { id: op.sessionId },
                    data: updateData,
                  });

                  changes.push({
                    operation: "update",
                    sessionId: op.sessionId,
                    success: true,
                  });
                } else if (op.type === "remove") {
                  const session = plan.sessions.find(
                    (s) => s.id === op.sessionId
                  );
                  if (!session) {
                    changes.push({
                      operation: "remove",
                      sessionId: op.sessionId,
                      success: false,
                      error: "Session not found",
                    });
                    continue;
                  }

                  await prisma.planSession.delete({
                    where: { id: op.sessionId },
                  });

                  changes.push({
                    operation: "remove",
                    sessionId: op.sessionId,
                    success: true,
                  });
                }
              } catch (error) {
                logger.error("Session operation failed:", error);
                changes.push({
                  operation: op.type,
                  sessionId: "sessionId" in op ? op.sessionId : undefined,
                  success: false,
                  error: error instanceof Error ? error.message : "Unknown error",
                });
              }
            }

            const successCount = changes.filter((c) => c.success).length;
            logger.info(
              `Plan ${planId} session operations: ${successCount}/${operations.length} successful`
            );

            return {
              success: successCount === operations.length,
              changes,
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
      },
    });

    return agent;
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
  }): Promise<{
    messageContent: string;
    planReplacements?: Array<{ textToReplace: string; planGoal: string }>;
    toolCalls?: Array<{ tool: string; args: unknown; result: unknown }>;
  }> {
    const { user, message, conversationHistory, plans, reminders } = params;

    const agent = this.createAgent({
      user,
      plans,
      reminders,
      conversationHistory,
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
              result: toolResult && "result" in toolResult ? toolResult.result : undefined,
            });
          }
        }
      }

      // Extract plan references from the response text
      const planReplacements = this.extractPlanReplacements(
        result.text,
        plans.map((p) => ({ id: p.id, goal: p.goal, emoji: p.emoji }))
      );

      return {
        messageContent: result.text,
        planReplacements: planReplacements.length > 0 ? planReplacements : undefined,
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      };
    } catch (error) {
      logger.error("Coach agent error:", error);
      throw error;
    }
  }
}

export const coachAgentService = new CoachAgentService();
