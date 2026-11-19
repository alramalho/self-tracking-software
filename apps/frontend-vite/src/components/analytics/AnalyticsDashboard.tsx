import { useApiWithAuth } from "@/api";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Play } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { BarChart, Legend, Segmented } from "./BarChart";
import { FunnelCard } from "./FunnelCard";
import type { AnalyticsOverview, VoiceNote } from "./types";

const RANGES = [7, 30, 90, 180] as const;
const METRICS = { dau: "DAU", wau: "WAU", mau: "MAU" } as const;
type Metric = keyof typeof METRICS;

const COLORS = {
  "--analytics-blue": "#4d9de0",
  "--analytics-green": "#34a853",
  "--analytics-red": "#e5534b",
  "--analytics-purple": "#8e6cd8",
  "--analytics-grey": "#9ca3af",
} as CSSProperties;

/** A remembered choice for this browser only (try/catch: private windows can refuse storage). */
function useStored<T extends string | number>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      return allowed.find((a) => String(a) === localStorage.getItem(key)) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      /* still works this session */
    }
  };
  return [value, set] as const;
}

const short = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const sum = <T,>(items: T[], pick: (item: T) => number) => items.reduce((n, item) => n + pick(item), 0);

export function AnalyticsDashboard() {
  const api = useApiWithAuth();
  const [range, setRange] = useStored<number>("tracking.analytics.range", 30, RANGES);
  const [metric, setMetric] = useStored<Metric>("tracking.analytics.metric", "dau", Object.keys(METRICS) as Metric[]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", range],
    queryFn: async () => (await api.get<AnalyticsOverview>(`/analytics/overview?days=${range}`)).data,
    placeholderData: (previous) => previous,
  });

  if (isLoading || !data)
    return (
      <Centered>
        {error ? <p className="text-sm text-muted-foreground">Couldn’t load analytics.</p> : <Loader2 className="size-6 animate-spin" />}
      </Centered>
    );

  const days = data.series;
  const today = days[days.length - 1];
  const lastWeek = days.slice(-7);
  const voiceTotal = sum(days, (d) => d.voice.kept + d.voice.dropped);
  const voiceKept = sum(days, (d) => d.voice.kept);

  return (
    <div className="fixed inset-0 overflow-auto bg-background text-foreground" style={COLORS}>
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pt-6 pb-16">
        <header className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold">tracking.so</h1>
          <Segmented options={RANGES.map((r) => ({ value: r as number, label: `${r}d` }))} value={range} onChange={setRange} />
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Signups · 7d" value={sum(lastWeek, (d) => d.signups)} sub={`${today?.signups ?? 0} today`} />
          <Stat label="Active · today" value={today?.dau ?? 0} sub={`${today?.wau ?? 0} this week · ${today?.mau ?? 0} month`} />
          <Stat label="Logs · 7d" value={sum(lastWeek, (d) => d.logs)} sub={`${today?.logs ?? 0} today`} />
          <Stat label="Voice notes · 7d" value={sum(lastWeek, (d) => d.voice.kept + d.voice.dropped)} sub={`${sum(lastWeek, (d) => d.voice.kept)} kept`} />
        </section>

        <Card title="Onboarding funnel" aside={<span className="text-xs text-muted-foreground">signups in {range}d</span>}>
          <FunnelCard funnel={data.funnel} />
        </Card>

        <section className="grid gap-4 md:grid-cols-2">
          <Card
            title="Active users"
            aside={<Segmented options={(Object.keys(METRICS) as Metric[]).map((m) => ({ value: m, label: METRICS[m] }))} value={metric} onChange={setMetric} />}
          >
            <BarChart bars={days.map((d) => ({ key: d.day, title: `${short(d.day)}: ${d[metric]} ${METRICS[metric]}`, segments: [{ value: d[metric], color: "var(--analytics-blue)" }] }))} />
            <Note>Now: {today?.[metric] ?? 0} · active = logged, checked in or wrote to the coach (UTC days)</Note>
          </Card>
          <Card title="Signups">
            <BarChart bars={days.map((d) => ({ key: d.day, title: `${short(d.day)}: ${d.signups} signups`, segments: [{ value: d.signups, color: "var(--analytics-purple)" }] }))} />
            <Note>{sum(days, (d) => d.signups)} in {range} days</Note>
          </Card>
          <Card title="Logs">
            <BarChart bars={days.map((d) => ({ key: d.day, title: `${short(d.day)}: ${d.logs} logs`, segments: [{ value: d.logs, color: "var(--analytics-green)" }] }))} />
            <Note>{sum(days, (d) => d.logs)} activities logged in {range} days</Note>
          </Card>
          <Card title="Voice notes" aside={<Legend items={[{ label: "kept", color: "var(--analytics-green)" }, { label: "not saved", color: "var(--analytics-red)" }]} />}>
            <BarChart
              bars={days.map((d) => ({
                key: d.day,
                title: `${short(d.day)}: ${d.voice.kept} kept, ${d.voice.dropped} not saved`,
                segments: [
                  { value: d.voice.kept, color: "var(--analytics-green)" },
                  { value: d.voice.dropped, color: "var(--analytics-red)" },
                ],
              }))}
            />
            <Note>
              {voiceTotal} notes · {voiceTotal ? Math.round((100 * voiceKept) / voiceTotal) : 0}% saved in {range} days
            </Note>
          </Card>
        </section>

        <Card title="Latest voice notes" aside={<span className="text-xs text-muted-foreground">{data.voiceNotes.length} most recent</span>}>
          {data.voiceNotes.length === 0 ? (
            <Note>No voice notes in the samples file yet.</Note>
          ) : (
            <Table head={["", "When", "Who", "Heard", "Logged as", ""]}>
              {data.voiceNotes.map((note) => (
                <tr key={note.clientRequestId} className="border-t border-foreground/5 align-top">
                  <td className="py-1.5 pr-2"><PlayButton note={note} /></td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{when(note.at)}</td>
                  <td className="py-1.5 pr-3">{note.username ?? "–"}</td>
                  <td className="py-1.5 pr-3">{note.transcript}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{note.heardAs.join(", ") || "nothing"}</td>
                  <td className="py-1.5 whitespace-nowrap">{note.kept ? <span className="text-[var(--analytics-green)]">kept</span> : <span className="text-muted-foreground">not saved</span>}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Most active users" aside={<span className="text-xs text-muted-foreground">last 30 days</span>}>
          <Table head={["Who", "Active days", "Logs", "Voice", "Plan", "Joined", "Last seen"]}>
            {data.topUsers.map((u) => (
              <tr key={u.id} className="border-t border-foreground/5">
                <td className="py-1.5 pr-3">{u.username ?? u.id.slice(0, 6)}</td>
                <td className="py-1.5 pr-3 tabular-nums">{u.activeDays}</td>
                <td className="py-1.5 pr-3 tabular-nums">{u.logs}</td>
                <td className="py-1.5 pr-3 tabular-nums">{u.voiceNotes}</td>
                <td className="py-1.5 pr-3">{u.plan === "PLUS" ? "Paid" : "Free"}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{new Date(u.signedUpAt).toLocaleDateString()}</td>
                <td className="py-1.5 whitespace-nowrap text-muted-foreground">{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : "–"}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </main>
    </div>
  );
}

function PlayButton({ note }: { note: VoiceNote }) {
  const api = useApiWithAuth();
  const [state, setState] = useState<"idle" | "loading" | "missing">(note.hasRecording ? "idle" : "missing");
  const play = async () => {
    setState("loading");
    const url = await api
      .get<{ url: string }>(`/analytics/voice-notes/${encodeURIComponent(note.clientRequestId)}/recording`)
      .then((r) => r.data.url)
      .catch(() => null);
    if (!url) return setState("missing");
    setState("idle");
    void new Audio(url).play();
  };
  if (state === "missing") return <span className="inline-block w-6 text-center text-muted-foreground">–</span>;
  return (
    <button onClick={() => void play()} disabled={state === "loading"} aria-label="Play recording" className="flex size-6 items-center justify-center rounded-full bg-foreground/5">
      {state === "loading" ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3 fill-current" />}
    </button>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-background text-foreground">{children}</div>;
}

function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-foreground/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-foreground/10 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="text-2xl tabular-nums">{value}</strong>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={i} className="pb-1.5 pr-3 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
