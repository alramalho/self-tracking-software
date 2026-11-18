import { useState } from "react";
import type { Funnel } from "./types";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5;
  return hours < 48 ? `${Math.max(1, Math.round(hours))}h ago` : `${Math.round(hours / 24)}d ago`;
};

/** Where signups stop: a bar per step, the drop from the step before, and who stopped there. */
export function FunnelCard({ funnel }: { funnel: Funnel }) {
  const [open, setOpen] = useState<string>();
  const total = funnel.steps[0]?.reached ?? 0;
  const biggestDrop = funnel.steps
    .slice(1)
    .reduce<{ id?: string; lost: number }>((worst, step, i) => {
      const lost = funnel.steps[i].reached - step.reached;
      return lost > worst.lost ? { id: step.id, lost } : worst;
    }, { lost: 0 });

  if (total === 0) return <p className="text-sm text-muted-foreground">No signups in the last {funnel.days} days.</p>;

  return (
    <div className="flex flex-col gap-1.5">
      {funnel.steps.map((step, i) => {
        const prev = i === 0 ? step.reached : funnel.steps[i - 1].reached;
        const lost = prev - step.reached;
        const isWorst = step.id === biggestDrop.id;
        const stopped = step.stoppedHere.length;
        return (
          <div key={step.id}>
            <button
              className="grid w-full grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-3 text-left text-sm disabled:cursor-default"
              onClick={() => setOpen(open === step.id ? undefined : step.id)}
              disabled={stopped === 0}
            >
              <span className={isWorst ? "font-semibold" : ""}>{step.label}</span>
              <span className="relative h-6 overflow-hidden rounded-md bg-foreground/5">
                <span
                  className="absolute inset-y-0 left-0 rounded-md"
                  style={{ width: `${(100 * step.reached) / total}%`, background: isWorst ? "var(--analytics-red)" : "var(--analytics-blue)" }}
                />
                <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium tabular-nums">
                  {step.reached} · {Math.round((100 * step.reached) / total)}%
                </span>
              </span>
              <span className="w-36 text-right text-xs tabular-nums text-muted-foreground">
                {i > 0 && lost > 0 ? `−${lost} (${Math.round((100 * lost) / prev)}%)` : ""}
                {stopped > 0 && <span className="ml-1 underline decoration-dotted">{stopped} stopped</span>}
                {step.inProgress > 0 && <span className="ml-1">· {step.inProgress} now</span>}
              </span>
            </button>
            {open === step.id && (
              <p className="mt-1 mb-2 pl-1 text-xs text-muted-foreground sm:pl-[15rem]">
                {step.stoppedHere.map((p) => `${p.username ?? p.id.slice(0, 6)} (joined ${ago(p.signedUpAt)}, seen ${ago(p.lastActiveAt)})`).join(" · ")}
              </p>
            )}
          </div>
        );
      })}
      <p className="mt-2 text-xs text-muted-foreground">
        Signups in the last {funnel.days} days, test accounts left out. Each person counts at the furthest point their saved onboarding shows (no step history, so "stopped" means
        no activity for a day). Paying now: {funnel.paying}. AI consent: {funnel.aiConsent.granted} yes · {funnel.aiConsent.declined} no ·{" "}
        {funnel.aiConsent.neverAsked} not asked.
      </p>
    </div>
  );
}
