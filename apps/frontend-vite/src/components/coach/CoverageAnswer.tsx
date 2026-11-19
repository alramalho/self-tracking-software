import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useApiWithAuth } from "@/api";
import { DrawerButton, DrawerHeader, DrawerOptions } from "@/components/drawer/ActionDrawer";
import { useActivities } from "@/contexts/activities/useActivities";
import { useCurrentUser } from "@/contexts/users";
import { getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { coachFace } from "./face";
import type { CoverageAnswerProps, CoverageReply } from "./coverageTypes";

/**
 * The web answer to "What did you cover?": the iPhone records a voice note, here it is typed.
 * The text is saved on the log, then the coach reads it against the plan (which also marks the
 * question answered). Clearly ahead or behind → the coach's note and Review change; else it closes.
 */
export function CoverageAnswer({ plan, entry, onClose, onSkip, skipping }: CoverageAnswerProps) {
  const api = useApiWithAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { upsertActivityEntry } = useActivities();
  const { currentUser } = useCurrentUser();
  const coach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<CoverageReply | null>(null);
  const activity = plan.activities.find((a) => a.id === entry.activityId);
  const subtitle = `${plan.goal}${activity && entry.quantity ? ` · ${entry.quantity} ${activity.measure}` : ""}`;

  const send = async () => {
    const said = text.trim();
    if (!said || !entry.activityId) return;
    setSaving(true);
    setError(null);
    try {
      // Keep anything already written on the log; the answer goes after it.
      const description = entry.description?.trim() ? `${entry.description.trim()}\n${said}` : said;
      if (entry.id) await upsertActivityEntry({ entry: { id: entry.id, description }, muteNotification: true });
      const date = format(new Date(entry.datetime), "yyyy-MM-dd");
      const { data } = await api.post<{ coverage: CoverageReply | null }>("/voice-logs/coverage", {
        logged: [{ activityId: entry.activityId, date }],
        said,
      });
      await client.invalidateQueries();
      if (data.coverage?.suggestion) setReply(data.coverage);
      else onClose();
    } catch (e) {
      const response = (e as { response?: { data?: { error?: unknown } } }).response;
      setError(typeof response?.data?.error === "string" ? response.data.error : "Couldn't send that. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (reply?.suggestion) {
    return (
      <>
        <div data-testid="coverage-suggestion" className="mt-9 flex items-start gap-3 rounded-2xl bg-card p-4">
          <img src={coachFace(currentUser?.coachPersonality)} alt="" className="h-12 w-12 shrink-0 object-contain" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-semibold text-muted-foreground">{coach.name}</span>
            <p className="text-base leading-snug">{reply.suggestion.message}</p>
          </div>
        </div>
        <DrawerOptions options={[{ label: "Not now", onClick: onClose }]} />
        <DrawerButton
          testId="coverage-review"
          label="Review change"
          onClick={() => {
            onClose();
            navigate({ to: "/message-ai" });
          }}
        />
      </>
    );
  }

  return (
    <>
      <DrawerHeader emoji={plan.emoji} title="What did you cover?" subtitle={subtitle} />
      <textarea
        data-testid="coverage-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What you covered, how it went"
        className="w-full resize-none rounded-2xl bg-card px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
      <DrawerOptions options={[{ label: "Not now", disabled: skipping || saving, onClick: onSkip }]} />
      <DrawerButton
        testId="coach-coverage-answer"
        label={`Tell ${coach.name}`}
        busy={saving}
        disabled={!text.trim()}
        onClick={send}
      />
    </>
  );
}
