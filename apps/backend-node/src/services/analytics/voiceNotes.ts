import { open, stat } from "node:fs/promises";
import { prisma } from "../../utils/prisma";
import { voiceLogSamplesFile } from "../voice-log/samples";
import { dayKey } from "./people";
import type { VoiceNote } from "./types";

// Voice notes come from the voice-log samples file on the host (services/voice-log/samples.ts): one line per
// preview and one per commit. A note is "kept" when a commit with the same clientRequestId followed.

const TAIL_BYTES = 8 * 1024 * 1024;
const RECENT = 60;

type Sample = {
  at: string;
  kind: "preview" | "follow-up" | "refinement" | "commit";
  userId: string;
  clientRequestId: string;
  transcript?: string;
  recordingKey?: string | null;
  catalog?: { activityId: string; title: string; measure: string }[];
  extraction?: { activities?: { activityId: string; quantity: number }[]; metrics?: unknown[]; note?: unknown };
};

/** The last few MB of the samples file, parsed. Empty when the file is off or missing. */
export async function readVoiceSamples(file = voiceLogSamplesFile()): Promise<Sample[]> {
  if (!file) return [];
  try {
    const { size } = await stat(file);
    const start = Math.max(0, size - TAIL_BYTES);
    const handle = await open(file, "r");
    try {
      const buffer = Buffer.alloc(size - start);
      await handle.read(buffer, 0, buffer.length, start);
      const lines = buffer.toString("utf8").split("\n");
      if (start > 0) lines.shift(); // probably cut mid-line
      return lines.flatMap((line) => {
        try {
          return line ? [JSON.parse(line) as Sample] : [];
        } catch {
          return [];
        }
      });
    } finally {
      await handle.close();
    }
  } catch {
    return [];
  }
}

export function summarizeVoice(samples: Sample[]) {
  const committed = new Set(samples.filter((s) => s.kind === "commit").map((s) => s.clientRequestId));
  // A refinement re-records under the same id: keep the latest heard version of each note.
  const notes = new Map<string, Sample>();
  for (const s of samples) if (s.kind !== "commit") notes.set(s.clientRequestId, s);
  const all = [...notes.values()];
  const perDay = new Map<string, { kept: number; dropped: number }>();
  for (const note of all) {
    const day = dayKey(new Date(note.at));
    const counts = perDay.get(day) ?? { kept: 0, dropped: 0 };
    if (committed.has(note.clientRequestId)) counts.kept++;
    else counts.dropped++;
    perDay.set(day, counts);
  }
  return { notes: all, committed, perDay };
}

export function heardAs(note: Sample): string[] {
  const titles = new Map((note.catalog ?? []).map((a) => [a.activityId, a]));
  const activities = (note.extraction?.activities ?? []).map((a) => {
    const activity = titles.get(a.activityId);
    return activity ? `${activity.title} ${a.quantity} ${activity.measure}` : `? ${a.quantity}`;
  });
  const metrics = note.extraction?.metrics?.length ? [`${note.extraction.metrics.length} check-in`] : [];
  const extra = note.extraction?.note ? ["note"] : [];
  return [...activities, ...metrics, ...extra];
}

export async function recentVoiceNotes(summary: ReturnType<typeof summarizeVoice>): Promise<VoiceNote[]> {
  const recent = summary.notes.slice(-RECENT).reverse();
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(recent.map((n) => n.userId))] } },
    select: { id: true, username: true },
  });
  const names = new Map(users.map((u) => [u.id, u.username]));
  return recent.map((note) => ({
    clientRequestId: note.clientRequestId,
    at: note.at,
    username: names.get(note.userId) ?? null,
    transcript: note.transcript ?? "",
    heardAs: heardAs(note),
    kept: summary.committed.has(note.clientRequestId),
    hasRecording: !!note.recordingKey,
  }));
}

/** The S3 key of a note's recording, looked up in the samples file so the page never sends a key itself. */
export async function recordingKeyFor(clientRequestId: string) {
  const samples = await readVoiceSamples();
  return samples.reverse().find((s) => s.clientRequestId === clientRequestId && s.recordingKey)?.recordingKey ?? null;
}
