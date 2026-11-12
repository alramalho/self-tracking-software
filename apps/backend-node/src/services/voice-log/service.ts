import { fromZonedTime } from "date-fns-tz";
import { prisma } from "../../utils/prisma";
import { sttService } from "../sttService";
import type { ActivityEntry, MetricEntry } from "@tsw/prisma";
import { logger } from "../../utils/logger";
import { extractVoiceLog, localDate } from "./extract";
import { recordVoiceLogSample } from "./samples";
import {
  voiceLogCommitSchema,
  type VoiceLogRefinementContext,
  type VoiceLogCommit,
  type VoiceLogPreview,
} from "./types";

const MAX_TRANSCRIPT_LENGTH = 4_000;

function resolveTimezone(candidate: string | undefined, fallback: string) {
  const value = candidate?.trim() || fallback || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return fallback || "UTC";
  }
}

function localDayBounds(date: string, timezone: string) {
  const nextDate = new Date(`${date}T12:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextDateString = nextDate.toISOString().slice(0, 10);
  return {
    start: fromZonedTime(`${date}T00:00:00`, timezone),
    end: fromZonedTime(`${nextDateString}T00:00:00`, timezone),
  };
}

function activityDateTime(
  date: string,
  time: string | null | undefined,
  timezone: string,
) {
  return fromZonedTime(`${date}T${time || "12:00"}:00`, timezone);
}

function metricDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

export async function previewVoiceLog(input: {
  userId: string;
  audioBytes: Buffer;
  audioFormat?: string;
  timezone?: string;
  clientRequestId: string;
  refinement?: VoiceLogRefinementContext;
  now?: Date;
}): Promise<VoiceLogPreview> {
  const previewStartedAt = Date.now();
  const now = input.now || new Date();
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { timezone: true, spokenLanguages: true },
  });
  const timezone = resolveTimezone(input.timezone, user?.timezone || "UTC");

  const sttStartedAt = Date.now();
  const heard = await sttService.transcribe(
    input.audioBytes,
    input.audioFormat,
    user?.spokenLanguages,
  );
  const transcript = heard.text.trim().slice(0, MAX_TRANSCRIPT_LENGTH);
  const sttDurationMs = Date.now() - sttStartedAt;
  if (!transcript) throw new Error("The recording did not contain speech.");

  const [activities, metrics, latestEntries] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: input.userId, deletedAt: null },
      select: { id: true, title: true, emoji: true, measure: true },
      orderBy: { title: "asc" },
    }),
    prisma.metric.findMany({
      where: { userId: input.userId },
      select: { id: true, title: true, emoji: true },
      orderBy: { title: "asc" },
    }),
    prisma.activityEntry.groupBy({
      by: ["activityId"],
      where: { userId: input.userId, deletedAt: null },
      _max: { datetime: true },
    }),
  ]);
  const lastLogged = new Map(
    latestEntries
      .filter((entry) => entry.activityId && entry._max.datetime)
      .map((entry) => [entry.activityId!, localDate(entry._max.datetime!, timezone)]),
  );

  const activityContext = activities.map((activity) => ({
    activityId: activity.id,
    title: activity.title,
    emoji: activity.emoji,
    measure: activity.measure,
    lastLoggedOn: lastLogged.get(activity.id) ?? null,
  }));
  const metricContext = metrics.map((metric) => ({
    metricId: metric.id,
    title: metric.title,
    emoji: metric.emoji,
  }));

  const generated = await extractVoiceLog({
    transcript,
    now,
    timezone,
    activities: activityContext,
    metrics: metricContext,
    refinement: input.refinement,
  });
  const { extraction, model, reasoningEffort } = generated;
  const modelDurationMs = generated.durationMs;

  const activityById = new Map(activityContext.map((activity) => [activity.activityId, activity]));
  const metricById = new Map(metricContext.map((metric) => [metric.metricId, metric]));

  const responseTranscript = input.refinement
    ? `${input.refinement.originalTranscript}\n\nFollow-up correction: ${transcript}`.slice(
        0,
        MAX_TRANSCRIPT_LENGTH,
      )
    : transcript;

  logger.info(
    `Voice log preview for ${input.userId}: ${extraction.activities.length} activities, ${extraction.metrics.length} metrics, ${extraction.unresolved.length} unresolved`,
  );
  logger.info("voice_log_preview_timing", {
    event: "voice_log_preview_timing",
    userId: input.userId,
    mode: input.refinement ? "refinement" : "initial",
    audioBytes: input.audioBytes.length,
    transcriptCharacters: transcript.length,
    sttDurationMs,
    modelDurationMs,
    totalDurationMs: Date.now() - previewStartedAt,
    model,
    reasoningEffort,
  });
  recordVoiceLogSample({
    kind: input.refinement ? "refinement" : "preview",
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    timezone,
    localDate: localDate(now, timezone),
    transcript,
    sttModel: heard.model,
    originalTranscript: input.refinement?.originalTranscript,
    catalog: activityContext.map(({ activityId, title, measure }) => ({ activityId, title, measure })),
    model,
    reasoningEffort,
    extraction,
  });

  return {
    clientRequestId: input.clientRequestId,
    transcript: responseTranscript,
    transcriptModel: heard.model,
    transcriptLanguage: heard.language,
    activities: extraction.activities.map((activity) => ({
      ...activity,
      title: activityById.get(activity.activityId)!.title,
      emoji: activityById.get(activity.activityId)!.emoji,
      measure: activityById.get(activity.activityId)!.measure,
    })),
    metrics: extraction.metrics.map((metric) => ({
      ...metric,
      title: metricById.get(metric.metricId)!.title,
      emoji: metricById.get(metric.metricId)!.emoji,
    })),
    note: extraction.note!,
    unresolved: extraction.unresolved,
  };
}

export async function commitVoiceLog(input: {
  userId: string;
  commit: VoiceLogCommit;
}) {
  const commit = voiceLogCommitSchema.parse(input.commit);
  recordVoiceLogSample({
    kind: "commit",
    userId: input.userId,
    clientRequestId: commit.clientRequestId,
    transcript: commit.transcript,
    activities: commit.activities,
    metrics: commit.metrics,
  });
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { timezone: true },
  });
  const timezone = resolveTimezone(commit.timezone, user?.timezone || "UTC");

  const result = await prisma.$transaction(async (tx) => {
    const existingMarker = await tx.userContextEvent.findFirst({
      where: {
        userId: input.userId,
        sourceMessageId: commit.clientRequestId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existingMarker) return { duplicate: true, activityEntries: [], metricEntries: [], note: existingMarker };

    const [activities, metrics] = await Promise.all([
      tx.activity.findMany({
        where: {
          userId: input.userId,
          deletedAt: null,
          id: { in: commit.activities.map((activity) => activity.activityId) },
        },
        select: { id: true },
      }),
      tx.metric.findMany({
        where: {
          userId: input.userId,
          id: { in: commit.metrics.map((metric) => metric.metricId) },
        },
        select: { id: true },
      }),
    ]);
    const activityIds = new Set(activities.map((activity) => activity.id));
    const metricIds = new Set(metrics.map((metric) => metric.id));
    if (commit.activities.some((activity) => !activityIds.has(activity.activityId))) {
      throw new Error("One or more activities are no longer available.");
    }
    if (commit.metrics.some((metric) => !metricIds.has(metric.metricId))) {
      throw new Error("One or more metrics are no longer available.");
    }

    const activityEntries: ActivityEntry[] = [];
    for (const activity of commit.activities) {
      const datetime = activityDateTime(activity.date, activity.time, timezone);
      const bounds = localDayBounds(activity.date, timezone);
      const existing = await tx.activityEntry.findFirst({
        where: {
          userId: input.userId,
          activityId: activity.activityId,
          deletedAt: null,
          ...(activity.time
            ? { datetime }
            : { datetime: { gte: bounds.start, lt: bounds.end } }),
        },
      });
      if (existing) {
        activityEntries.push(
          await tx.activityEntry.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + activity.quantity,
              description: activity.description || existing.description,
              privateNotes: activity.privateNotes || existing.privateNotes,
              difficulty: activity.difficulty || existing.difficulty,
            },
          }),
        );
      } else {
        activityEntries.push(
          await tx.activityEntry.create({
            data: {
              userId: input.userId,
              activityId: activity.activityId,
              quantity: activity.quantity,
              datetime,
              description: activity.description || null,
              privateNotes: activity.privateNotes || null,
              difficulty: activity.difficulty || null,
              timezone,
              source: "voice",
            },
          }),
        );
      }
    }

    const metricEntries: MetricEntry[] = [];
    for (const metric of commit.metrics) {
      metricEntries.push(
        await tx.metricEntry.create({
          data: {
            userId: input.userId,
            metricId: metric.metricId,
            rating: metric.rating * 2,
            createdAt: metricDate(metric.date),
            description: metric.description || null,
          },
        }),
      );
    }

    const note = await tx.userContextEvent.create({
      data: {
        userId: input.userId,
        title: commit.note.title,
        description: commit.note.text,
        occurredAt: activityDateTime(commit.note.date, null, timezone),
        source: "USER_REPORTED",
        sourceMessageId: commit.clientRequestId,
        confidence: commit.note.confidence,
      },
    });

    const affectedActivityIds = Array.from(
      new Set(commit.activities.map((activity) => activity.activityId)),
    );
    if (affectedActivityIds.length > 0) {
      await tx.plan.updateMany({
        where: {
          userId: input.userId,
          deletedAt: null,
          activities: { some: { id: { in: affectedActivityIds } } },
        },
        data: { progressCalculatedAt: null },
      });
    }
    await tx.user.update({
      where: { id: input.userId },
      data: { lastActiveAt: new Date() },
    });

    return { duplicate: false, activityEntries, metricEntries, note };
  });

  return {
    success: true,
    duplicate: result.duplicate,
    activityEntryIds: result.activityEntries.map((entry) => entry.id),
    metricEntryIds: result.metricEntries.map((entry) => entry.id),
    noteId: result.note.id,
  };
}
