import { Archive } from "lucide-react";
import type { CoachAttentionItem } from "@/contexts/ai/types";

function factValue(item: CoachAttentionItem, label: string) {
  return item.facts.find((fact) => fact.label === label)?.value;
}

function formatHumanDate(value?: string) {
  if (!value || value === "None" || value === "No end date") return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

// Read-only summary of actions the coach already took (currently: auto-archived
// plans). Distinct from proposal cards — there is nothing to accept or reject.
export function CoachActionsCard({ items }: { items: CoachAttentionItem[] }) {
  const archived = items.filter((item) => item.kind === "SPECIFIC_AUTO_ARCHIVED");
  if (archived.length === 0) return null;

  return (
    <div className="mt-2 rounded-2xl border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <Archive className="h-4 w-4 text-amber-500" />
        {archived.length === 1
          ? "Plan archived"
          : `${archived.length} plans archived`}
      </div>
      <div className="space-y-1.5">
        {archived.map((item) => (
          <div
            key={item.dedupeKey}
            className="flex items-start gap-2 rounded-xl bg-background/60 px-2.5 py-2"
          >
            <span className="text-lg leading-none">{item.planEmoji || "🎯"}</span>
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{item.planGoal}</p>
              <p className="text-xs text-muted-foreground">
                Last planned {formatHumanDate(factValue(item, "Last planned session"))}
                {" · "}
                Ends {formatHumanDate(factValue(item, "Plan end"))}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Unarchive from old &amp; archived plans when you&apos;re ready to rebuild.
      </p>
    </div>
  );
}
