import { DAY_MS } from "./people";
import { dailySeries, topUsers } from "./activity";
import { onboardingFunnel } from "./funnel";
import type { AnalyticsOverview } from "./types";
import { readVoiceSamples, recentVoiceNotes, summarizeVoice } from "./voiceNotes";

export async function analyticsOverview(days: number): Promise<AnalyticsOverview> {
  const span = Math.min(Math.max(Math.round(days) || 30, 1), 366);
  const voice = summarizeVoice(await readVoiceSamples());
  const monthAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const voiceByUser = new Map<string, number>();
  for (const note of voice.notes) if (note.at >= monthAgo) voiceByUser.set(note.userId, (voiceByUser.get(note.userId) ?? 0) + 1);
  const [funnel, series, voiceNotes, top] = await Promise.all([
    onboardingFunnel(span),
    dailySeries(span, voice.perDay),
    recentVoiceNotes(voice),
    topUsers(voiceByUser),
  ]);
  return { generatedAt: new Date().toISOString(), funnel, series, voiceNotes, topUsers: top };
}
