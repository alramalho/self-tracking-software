import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { ToolLoopAgent, hasToolCall, tool } from "ai";
import { z } from "zod/v4";
import { Plan, PlanMilestone, PlanSession, Activity, User, Reminder, RecurringType } from "@tsw/prisma";
import { prisma } from "../utils/prisma";
import { differenceInCalendarDays, format, endOfWeek, startOfWeek, addDays, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { activitySummarizer } from "./activitySummarizer";
import { getPreviousCoachWeekBounds, toMidnightUTCDate } from "../utils/date";
import { logger } from "../utils/logger";
import { getCurrentUser } from "../utils/requestContext";
import dedent from "dedent";
import { TelegramService } from "./telegramService";
import { getCoachPersonalityConfig } from "./coachPersonalityService";
import { webSearchService } from "./webSearchService";

interface CoachAgentContext {
  user: User;
  plans: (Plan & { activities: Activity[]; sessions: PlanSession[]; milestones: PlanMilestone[] })[];
  reminders: Reminder[];
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  memoriesContext?: string | null;
  recentActivityContext?: string | null;
  onStatus?: (status: "thinking" | "searching" | "drafting") => void | Promise<void>;
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
  private telegram = new TelegramService();

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
      onStatus,
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

        const milestonesStr = (plan.milestones || [])
          .map((milestone) => {
            const progress =
              milestone.progress === null || milestone.progress === undefined
                ? "not set"
                : `${milestone.progress}%`;
            return `    ${format(new Date(milestone.date), "yyyy-MM-dd")}: ${milestone.description} (${progress}) [milestoneId: ${milestone.id}]`;
          })
          .join("\n");

        const isTimesPerWeek = plan.outlineType === "TIMES_PER_WEEK";
        return dedent`
          Plan: ${plan.goal} [planId: ${plan.id}]
          Emoji: ${plan.emoji || "none"}
          ${plan.goalReason ? `Why: ${plan.goalReason}` : ""}
          Type: ${isTimesPerWeek ? `${plan.timesPerWeek}x per week (frequency-based, no scheduled sessions)` : "Specific scheduled sessions"}
          Activities: ${activities}
          ${isTimesPerWeek ? "" : `Sessions:\n          ${sessionsStr || "    No sessions scheduled"}`}
          Milestones:
          ${milestonesStr || "    No milestones set"}
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

    const userFirstName =
      (user.name || "").trim().split(/\s+/)[0] || user.username;

    const agent = new ToolLoopAgent({
      model: this.getOpenRouterWithUserId().chat("google/gemini-3-flash-preview"),
      temperature: 0.5,
      stopWhen: hasToolCall("draftMessages"),
      instructions: dedent`
        You are ${coachPersonality.displayName}, ${coachPersonality.title}, a general-purpose coach. You can help with planning, learning, work, health, habits, relationships, decisions, creative projects, and any other topic the user brings up.

        ${coachPersonality.systemPrompt}

        CONTEXT
        User: ${userFirstName}
        Today: ${format(today, "yyyy-MM-dd (EEEE)")}
        Current week ends: ${format(thisWeekEnd, "yyyy-MM-dd")} (Saturday)

        ${plansContext ? `TRACKING.SO PLAN CONTEXT (optional, use only when relevant):\n${plansContext}` : "No active plans."}

        ${recentActivityContext ? `RECENT ACTIVITY FACTS:\n${recentActivityContext}` : ""}

        ${remindersContext ? `USER'S REMINDERS:\n${remindersContext}` : "No active reminders."}

        ${memoriesContext ? `LONG-TERM MEMORY (key facts about this user):\n${memoriesContext}` : ""}

        GUIDELINES
        - Ask clarifying questions before making changes: current experience, constraints, things to avoid
        - Research first, then advise. Web search results override your assumptions
        - Be direct, concise, and realistic. If a goal is unrealistic given constraints, say so
        - Suggesting the user adjust their goal is better than setting them up to fail
        - The coach can see and help with every active plan. If there are no active plans, treat that as setup, not an error.
        - When a plan goal is vague or purely frequency-based, mention that plan by its exact goal text from USER'S PLANS so it can be linked in the UI.
        - If the user gives a concrete measurable goal, use proposePlanCreation for a new goal or proposePlanModification with patch.plan for an existing plan.
        - For plan creation, explicitly decide whether it is frequency-based (TIMES_PER_WEEK) or session-based (SPECIFIC). If you choose SPECIFIC, include dated sessions or clearly tell the user sessions still need setup.
        - For plan creation goalReason, capture only the user's inner motivation or desired personal outcome, such as confidence, independence, career mobility, health, identity, or a specific life reason. Do not use logistics, availability, employment status, schedule, or constraints as goalReason. If the user has not shared a real why, leave goalReason null.
        - Any capability not provided by the available tools is not available to you.
        - When saying the user logged, did, trained, or practiced something recently/lately, rely only on RECENT ACTIVITY FACTS or readActivities output. Active plans and long-term memory are not recent activity evidence.
        - If an activity only appears in a plan, describe it as a goal/planned activity, not something the user has logged.
        - "Recently" and "lately" mean inside the recent activity lookback unless the readActivities tool returns a different date range.
        - Use webSearch only when fresh outside knowledge materially changes the answer.
        - If you rely on a webSearch result, cite it inline with that result's citationLabel, like [1]. Cite only the sources you actually used.
        - For exact web extraction tasks, such as "how many videos", "all titles", "modules", "durations", or "time to complete", do not answer from a weak first result. Search reactively: first search the exact URL or identifier, then search broader phrasing if the result lacks the exact facts.
        - When a user provides a URL, include that exact URL or a unique identifier from it in the first webSearch query. If the first search only gives generic snippets, call webSearch again with alternate terms, source names, and likely mirror/index pages.
        - For playlist/course extraction, prefer primary sources when they include the needed facts, but it is acceptable to use indexed mirrors or course listing pages when they expose exact titles, modules, or durations that the primary page hides.
        - Before drafting the final answer for exact extraction tasks, reconcile the numbers yourself. For example, add course/module hours and convert total hours into weeks based on the user's stated weekly availability.
        - Never invent exact counts, titles, modules, or hours. Only state exact facts when a search result title/snippet contains that fact. Do not infer a playlist count from a video index, number of search results, or vague playlist references.
        - If webSearch fails or returns no relevant exact facts, do not answer from memory and do not promise to keep searching after the message. Say what could not be verified and ask for the missing source details or permission to proceed with rough assumptions.
        - If at least two webSearch attempts still do not expose the exact requested facts, say that you could not verify the exact answer from search results and offer the closest verified facts.
        - For exact extraction from lists, playlists, course pages, catalogs, or schedules, distinguish item metadata from collection metadata. An item title, item number, URL index, timestamp, or episode label is not evidence for the total collection count.
        - Good follow-up searches vary the query shape rather than guessing: exact URL, stable identifier from the URL, exact page/list title if discovered, source/domain name, and the requested fact type such as titles, modules, durations, count, or schedule.

        RULES
        - Never modify sessions or reminders without user confirmation
        - Sound like a sharp friend texting, not a report. Prefer plain words over coaching jargon.
        - Default to 1-2 short messages. Only use a third message when a tool proposal needs a separate confirmation.
        - Keep each message to 1-2 short sentences unless the user explicitly asks for a list, table, syllabus, module breakdown, or exact extracted facts. In those cases, give the complete useful answer.
        - Make one point, then ask one natural next-step question if needed.
        - Avoid stiff phrases like "concrete, measurable outcome", "frequency alone is not a strategy", or "serious coached plan" unless the user used them first.
        - Do not say you updated, switched, set, or changed a plan unless the user already accepted the proposal. Before acceptance, say "I can propose..." or "I'd make this..."
        - draftMessages is the final visible response for this turn, not a progress update. Never use draftMessages to say you are going to search, find, map out, propose, schedule, or send something later in the same turn. Do the tool work first, then draft the result.
        - Do not say "I proposed", "I'll propose", "I'll suggest", or "I suggested" a plan/schedule unless a proposePlanCreation or proposePlanModification tool call succeeded in this turn and the proposal will be attached to the final message. If you are only discussing an idea, say "we can sketch" or ask a confirming question instead.
        - Do not use update_plan as a cosmetic rename. It should represent a meaningful plan setup change, such as goal, reason, outline type, weekly frequency, sessions, milestones, activities, or date.
        - When you propose creating or updating a plan, be transparent about the setup: say whether it is times/week or specific dated sessions, which activities are included, and whether milestones, finishing date, and sessions are included now or need setup after accepting.
        - For bigger rebuilds, especially new activity mixes like strength plus running, work in two stages: first confirm the target and weekly split, then propose the plan or sessions that actually encode it.
        - If the existing plan cannot represent the new activity mix or schedule, prefer proposing a new plan after confirmation instead of only renaming the old plan.
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
            "Search the web for current or specialized information. You can pass one query or several alternate queries. Use repeated searches when exact URLs, playlists, titles, modules, durations, or completion-time facts are not available in the first result set.",
          inputSchema: z.object({
            query: z
              .string()
              .optional()
              .describe("A single search query to find relevant information"),
            queries: z
              .array(z.string())
              .min(1)
              .max(4)
              .optional()
              .describe("Several alternate search queries to run together when triangulating exact facts"),
            maxResults: z
              .number()
              .int()
              .min(1)
              .max(10)
              .optional()
              .describe("Maximum results to return. Use 8-10 for exact extraction tasks."),
            maxTokensPerPage: z
              .number()
              .int()
              .min(256)
              .max(4096)
              .optional()
              .describe("Search page token budget. Use 1500-3000 for exact extraction tasks."),
          }),
          execute: async ({ query, queries, maxResults, maxTokensPerPage }) => {
            const searchQueries = queries?.length ? queries : query ? [query] : [];
            if (searchQueries.length === 0) {
              return {
                success: false as const,
                error: "Provide query or queries",
                results: [] as Array<{ title: string; snippet: string; url: string }>,
              };
            }

            await onStatus?.("searching");

            const searchResult = await webSearchService.searchWithOpenAI({
              query,
              queries,
              maxResults,
              maxTokensPerPage,
            });
            // Toggle back for comparison runs:
            // const searchResult = await webSearchService.searchWithPerplexity({
            //   query,
            //   queries,
            //   maxResults,
            //   maxTokensPerPage,
            // });

            if (!searchResult.success) {
              logger.error(`Web search failed: ${searchResult.error}`);
              self.telegram.sendMessage(
                `🔴 Coach webSearch tool failed\nUser: ${user.username}\nProvider: ${searchResult.provider}\nQuery: ${searchQueries.join(" | ")}\nError: ${searchResult.error}`
              );
              return {
                success: false as const,
                provider: searchResult.provider,
                error: `Search failed via ${searchResult.provider}: ${searchResult.error}. Do not state exact searched facts from memory. Tell the user search is unavailable or ask for the source details needed to continue.`,
                results: [] as Array<{ title: string; snippet: string; url: string }>,
              };
            }

            const results = searchResult.results.map((result) => {
              const citationIndex = nextCitationIndex++;
              return {
                citationIndex,
                citationLabel: `[${citationIndex}]`,
                title: result.title,
                snippet: result.snippet,
                url: result.url,
              };
            });

            logger.info(
              `Web search (${searchResult.provider}) for "${searchQueries.join(" | ")}" returned ${results.length} results`
            );

            return {
              success: true as const,
              provider: searchResult.provider,
              query: searchResult.query,
              queries: searchResult.queries,
              citationInstruction:
                "If you use a result in your final answer, cite it inline with its citationLabel.",
              results,
            };
          },
        }),

        proposePlanModification: tool({
          description: dedent`
            Propose a typed patch to a user's plan. The user will be able to accept or reject the proposal with one click.
            You can propose to:
            - Tighten plan setup with patch.plan
            - Add or update sessions with patch.sessions.upsert
            - Remove sessions with patch.sessions.deleteIds
            - Add or update milestones with patch.milestones.upsert
            - Remove milestones with patch.milestones.deleteIds
            - Archive a dormant plan with patch.archive

            Use the planId, activityId, sessionId, and milestoneId values from the plan context above.
            IMPORTANT: Always provide a clear, short description of what the proposal does (e.g. "Archive gym for now", "Pause chess for next week", "Reduce gym to 2x/week").
            IMPORTANT: Omitted fields mean "leave unchanged". Do not provide full relation arrays. Use upsert/deleteIds only.
            IMPORTANT: Archive must be standalone. Do not combine archive with other patch fields.
            IMPORTANT: When adding sessions, always propose a COMPLETE week (Sun-Sat). Never propose a partial week update (e.g. just Monday-Wednesday). Always cover the full week schedule. Discuss the full week with the user before proposing.
            IMPORTANT: Milestone progress is a 0-100 number. Propose milestone changes only when they make the user's plan clearer or easier to follow.
          `,
          inputSchema: z.object({
            planId: z.string().describe("The ID of the plan to modify"),
            description: z
              .string()
              .describe(
                "Short human-readable description of the proposal (e.g. 'Pause chess for next week')"
              ),
            patch: z.object({
              archive: z.literal(true).optional(),
              plan: z.object({
                goal: z.string().optional().describe("Clearer measurable plan goal"),
                goalReason: z.string().optional().nullable().describe("Why this plan matters to the user"),
                outlineType: z.enum(["SPECIFIC", "TIMES_PER_WEEK"]).optional(),
                timesPerWeek: z.number().positive().nullable().optional(),
              }).optional(),
              sessions: z.object({
                upsert: z.array(z.object({
                  id: z.string().optional().describe("Existing sessionId. Omit to create a new session."),
                  activityId: z.string().optional().describe("Required for new sessions. Optional for updates."),
                  date: z.string().optional().describe("YYYY-MM-DD date"),
                  quantity: z.number().positive().optional(),
                  descriptiveGuide: z.string().optional(),
                })).optional(),
                deleteIds: z.array(z.string()).optional().describe("Existing sessionIds to delete"),
              }).optional(),
              milestones: z.object({
                upsert: z.array(z.object({
                  id: z.string().optional().describe("Existing milestoneId. Omit to create a new milestone."),
                  description: z.string().optional(),
                  date: z.string().optional().describe("YYYY-MM-DD date"),
                  progress: z.number().min(0).max(100).nullable().optional(),
                  criteria: z.string().nullable().optional(),
                })).optional(),
                deleteIds: z.array(z.string()).optional().describe("Existing milestoneIds to delete"),
              }).optional(),
            }),
          }),
          execute: async ({ planId, description, patch }) => {
            const hasChanges = !!(
              patch.archive ||
              patch.plan ||
              patch.sessions?.upsert?.length ||
              patch.sessions?.deleteIds?.length ||
              patch.milestones?.upsert?.length ||
              patch.milestones?.deleteIds?.length
            );
            if (!hasChanges) {
              return {
                success: false,
                error: "This tool cannot be called with an empty patch",
              };
            }

            if (
              patch.archive &&
              (patch.plan ||
                patch.sessions?.upsert?.length ||
                patch.sessions?.deleteIds?.length ||
                patch.milestones?.upsert?.length ||
                patch.milestones?.deleteIds?.length)
            ) {
              return {
                success: false,
                error: "Archive must be proposed as a standalone patch",
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
            const sessionUpserts = patch.sessions?.upsert || [];
            const invalidActivityIds = sessionUpserts
              .map((session) => session.activityId)
              .filter(
                (activityId): activityId is string =>
                  !!activityId && !planActivityIds.has(activityId)
              );
            if (invalidActivityIds.length > 0) {
              const validActivities = plan.activities
                .map((a) => `${a.emoji} ${a.title} [${a.id}]`)
                .join(", ");
              return {
                success: false,
                error: `Some operations reference activities not in this plan. Valid activities for "${plan.goal}": ${validActivities}`,
              };
            }

            const sessionIds = new Set(plan.sessions.map((session) => session.id));
            const invalidSessionIds = [
              ...(patch.sessions?.deleteIds || []),
              ...sessionUpserts
                .map((session) => session.id)
                .filter((id): id is string => !!id),
            ].filter((sessionId) => !sessionIds.has(sessionId));
            if (invalidSessionIds.length > 0) {
              return {
                success: false,
                error: `Some session IDs do not belong to this plan: ${invalidSessionIds.join(", ")}`,
              };
            }

            const milestoneIds = new Set(plan.milestones.map((milestone) => milestone.id));
            const milestoneUpserts = patch.milestones?.upsert || [];
            const invalidMilestoneIds = [
              ...(patch.milestones?.deleteIds || []),
              ...milestoneUpserts
                .map((milestone) => milestone.id)
                .filter((id): id is string => !!id),
            ].filter((milestoneId) => !milestoneIds.has(milestoneId));
            if (invalidMilestoneIds.length > 0) {
              return {
                success: false,
                error: `Some milestone IDs do not belong to this plan: ${invalidMilestoneIds.join(", ")}`,
              };
            }

            const newSessions = sessionUpserts.filter((session) => !session.id);
            const incompleteNewSession = newSessions.find(
              (session) => !session.activityId || !session.date || !session.quantity
            );
            if (incompleteNewSession) {
              return {
                success: false,
                error: "New sessions require activityId, date, and quantity",
              };
            }

            const newMilestone = milestoneUpserts.find((milestone) => !milestone.id);
            if (newMilestone && (!newMilestone.description || !newMilestone.date)) {
              return {
                success: false,
                error: "New milestones require description and date",
              };
            }

            if (newSessions.length > 0) {
              const dates = newSessions.map((session) => parseISO(session.date!));
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
              `Plan modification proposed for ${planId}: "${description}"`
            );

            return {
              success: true,
              proposal: {
                planId,
                planGoal: plan.goal,
                planEmoji: plan.emoji,
                description,
                patch,
              },
            };
          },
        }),

        proposePlanCreation: tool({
          description: dedent`
            Propose creating a new tracked plan. The user can accept or reject the proposal with one click.
            Use this only after the user clearly asks for a new tracked plan or agrees to turn the conversation into one.
            Prefer goals that are clear enough to track, but do not force every coaching conversation into a plan.
          `,
          inputSchema: z.object({
            goal: z.string().describe("Short, concrete, measurable goal"),
            goalReason: z.string().optional().nullable().describe("The user's inner motivation or desired personal outcome, if known. Do not put logistics, schedule, employment status, or constraints here."),
            emoji: z.string().optional().describe("Single emoji for the plan"),
            outlineType: z.enum(["TIMES_PER_WEEK", "SPECIFIC"]).optional().describe("TIMES_PER_WEEK for a weekly target, SPECIFIC for dated sessions."),
            timesPerWeek: z.number().positive().optional().describe("Suggested weekly frequency, if known"),
            activities: z.array(z.object({
              title: z.string().describe("Activity title, e.g. Easy run"),
              measure: z.string().describe("Tracking unit, e.g. km, minutes, reps"),
              emoji: z.string().describe("Single emoji for the activity"),
              kind: z.string().optional().describe("Activity kind/category"),
            })).min(1).max(5).optional(),
            finishingDate: z.string().optional().nullable().describe("Optional plan end date in YYYY-MM-DD format"),
            milestones: z.array(z.object({
              description: z.string().describe("Milestone description"),
              date: z.string().describe("Milestone date in YYYY-MM-DD format"),
              criteria: z.string().optional().nullable().describe("Optional completion criteria"),
            })).max(6).optional(),
            sessions: z.array(z.object({
              activityTitle: z.string().describe("Activity title matching one of the proposed activities"),
              date: z.string().describe("Session date in YYYY-MM-DD format"),
              quantity: z.number().positive().optional().describe("Session quantity using the activity measure"),
              descriptiveGuide: z.string().optional().nullable().describe("Short session guidance"),
            })).max(21).optional(),
            description: z.string().optional().describe("Short human-readable description"),
          }),
          execute: async ({
            goal,
            goalReason,
            emoji,
            outlineType,
            timesPerWeek,
            activities,
            finishingDate,
            milestones,
            sessions,
            description,
          }) => {
            logger.info(
              `Plan creation proposed for ${user.id}: "${goal}" (${activities?.length || 0} activities)`
            );

            return {
              success: true,
              proposal: {
                goal,
                goalReason: goalReason || null,
                emoji: emoji || "🎯",
                outlineType:
                  outlineType ||
                  ((sessions?.length || 0) > 0 ? "SPECIFIC" : "TIMES_PER_WEEK"),
                timesPerWeek: timesPerWeek || null,
                activities: activities || [],
                finishingDate: finishingDate || null,
                milestones: milestones || [],
                sessions: sessions || [],
                description: description || `Create tracked plan: ${goal}`,
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
    plans: (Plan & { activities: Activity[]; sessions: PlanSession[]; milestones: PlanMilestone[] })[],
    days = 30
  ): Promise<string> {
    const from = startOfDay(subDays(now, days));
    const { start: previousWeekStart, end: previousWeekEnd } =
      getPreviousCoachWeekBounds(now, user.timezone);
    const planActivityIds = Array.from(
      new Set(plans.flatMap((plan) => plan.activities.map((activity) => activity.id)))
    );
    const [entries, previousWeekEntries] = await Promise.all([
      prisma.activityEntry.findMany({
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
      }),
      planActivityIds.length > 0
        ? prisma.activityEntry.findMany({
            where: {
              userId: user.id,
              deletedAt: null,
              activityId: { in: planActivityIds },
              activity: { deletedAt: null },
              datetime: { gte: previousWeekStart, lte: previousWeekEnd },
            },
            include: {
              activity: {
                select: { title: true, emoji: true, measure: true },
              },
            },
            orderBy: { datetime: "asc" },
          })
        : Promise.resolve([]),
    ]);

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

    const previousWeekRollups = plans.map((plan) => {
      const planActivityIds = new Set(plan.activities.map((activity) => activity.id));
      const planEntries = previousWeekEntries.filter(
        (entry) =>
          entry.activityId &&
          planActivityIds.has(entry.activityId)
      );
      const target = plan.outlineType === "TIMES_PER_WEEK" && plan.timesPerWeek
        ? `${planEntries.length}/${plan.timesPerWeek}`
        : `${planEntries.length}`;
      const entriesText = planEntries.length > 0
        ? planEntries
            .map((entry) =>
              entry.activity
                ? `${format(entry.datetime, "yyyy-MM-dd")} ${entry.activity.emoji} ${entry.activity.title}`
                : `${format(entry.datetime, "yyyy-MM-dd")} unknown activity`
            )
            .join("; ")
        : "none";

      return `- ${plan.emoji || ""} ${plan.goal}: ${target} linked activity entries. Entries: ${entriesText}.`;
    });

    return [
      `Lookback: last ${days} days.`,
      `Logged activity counts: ${summary || "none"}.`,
      `Previous completed week: ${format(previousWeekStart, "yyyy-MM-dd")} to ${format(previousWeekEnd, "yyyy-MM-dd")} (Sunday-Saturday).`,
      "Times-per-week completion rule: every logged activity entry linked to a times-per-week plan counts as one completion, regardless of whether the activity measure is sessions, km, minutes, or something else.",
      "Plan weekly rollups:",
      ...(previousWeekRollups.length > 0 ? previousWeekRollups : ["- none"]),
      entries.length > 0
        ? "Most recent entries:"
        : "Most recent entries: none. Do not call any plan activity recent unless readActivities returns newer data.",
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
    plans: (Plan & { activities: Activity[]; sessions: PlanSession[]; milestones: PlanMilestone[] })[];
    reminders: Reminder[];
    memoriesContext?: string | null;
    onStatus?: (status: "thinking" | "searching" | "drafting") => void | Promise<void>;
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
        patch: unknown;
        operations?: unknown[];
        status: null;
      }>;
      planCreationProposals?: Array<{
        goal: string;
        goalReason: string | null;
        emoji: string | null;
        outlineType?: "SPECIFIC" | "TIMES_PER_WEEK" | null;
        timesPerWeek: number | null;
        activities: Array<{ title: string; measure: string; emoji: string; kind?: string | null }>;
        finishingDate?: string | null;
        milestones?: Array<{ description: string; date: string; criteria?: string | null }>;
        sessions?: Array<{
          activityTitle: string;
          date: string;
          quantity?: number | null;
          descriptiveGuide?: string | null;
        }>;
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
    const { user, message, conversationHistory, plans, reminders, memoriesContext, onStatus } = params;
    await onStatus?.("thinking");
    const activePlans = plans.filter((plan) => isActiveCoachPlan(plan));
    const recentActivityContext = await this.buildRecentActivityContext(
      user,
      new Date(),
      activePlans
    );

    const agent = this.createAgent({
      user,
      plans: activePlans,
      reminders,
      conversationHistory,
      memoriesContext,
      recentActivityContext,
      onStatus,
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

      await onStatus?.("drafting");

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
