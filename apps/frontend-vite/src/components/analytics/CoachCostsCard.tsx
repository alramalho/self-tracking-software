import { BarChart, Legend } from "./BarChart";
import type { CoachCostPart, CoachCosts } from "./types";

const PART_COLORS: Record<CoachCostPart, string> = {
  chat: "var(--analytics-blue)",
  search: "var(--analytics-purple)",
  checkins: "var(--analytics-green)",
  talk: "var(--analytics-grey)",
};

const usd = (n: number) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(4)}` : n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n)}`);
const short = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

/** What the coach costs in AI calls (the gateway's own prices), by day, part, model and person. */
export function CoachCostsCard({ costs }: { costs: CoachCosts }) {
  const parts = costs.parts.map((p) => p.part);
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-foreground/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Coach costs</h2>
        <Legend items={costs.parts.map((p) => ({ label: p.label, color: PART_COLORS[p.part] }))} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums">{usd(costs.totalUsd)}</span>
        <span className="self-end pb-1 text-xs text-muted-foreground">
          in {costs.days} days{costs.perReplyUsd !== null && ` · ${usd(costs.perReplyUsd)} per chat reply, searches included`}
        </span>
      </div>
      <BarChart
        maxLabel={usd}
        bars={costs.perDay.map((d) => ({
          key: d.day,
          title: `${short(d.day)}: ${usd(parts.reduce((n, p) => n + d[p], 0))}`,
          segments: parts.map((p) => ({ value: d[p], color: PART_COLORS[p] })),
        }))}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Rows title="Part" rows={costs.parts.map((p) => ({ key: p.part, label: p.label, usd: p.usd, calls: p.calls }))} />
        <Rows title="Model" rows={costs.models.map((m) => ({ key: m.model, label: m.model.replace(/^[^/]+\//, ""), usd: m.usd, calls: m.calls }))} />
        <Rows
          title="Who"
          empty="Counted from 24 Nov"
          rows={costs.people.map((p, i) => ({ key: `${p.username}-${i}`, label: p.username ?? "–", usd: p.usd, calls: p.calls }))}
        />
      </div>
      <p className="text-xs text-muted-foreground">Web search, check-ins and who are counted from 24 Nov 2026; chat replies from 2 Nov.</p>
    </section>
  );
}

function Rows({ title, rows, empty }: { title: string; rows: { key: string; label: string; usd: number; calls: number }[]; empty?: string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="pb-1.5 pr-3 font-normal">{title}</th>
          <th className="pb-1.5 pr-3 text-right font-normal">Calls</th>
          <th className="pb-1.5 text-right font-normal">Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={3} className="py-1.5 text-xs text-muted-foreground">{empty ?? "None yet"}</td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-foreground/5">
            <td className="max-w-0 truncate py-1.5 pr-3">{r.label}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{r.calls}</td>
            <td className="py-1.5 text-right tabular-nums">{usd(r.usd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
