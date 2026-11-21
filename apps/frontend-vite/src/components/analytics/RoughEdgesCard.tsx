import type { RoughEdges } from "./types";

/** Failures people actually ran into last week: what kind, how often, and the latest few. */
export function RoughEdgesCard({ edges, when }: { edges: RoughEdges; when: (iso: string) => string }) {
  const total = edges.kinds.reduce((sum, k) => sum + k.count, 0);
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-foreground/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Rough edges</h2>
        <span className="text-xs text-muted-foreground">last {edges.days} days</span>
      </div>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing went wrong for anyone.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2">
            {edges.kinds.map((k) => (
              <li key={k.kind} className="flex items-baseline gap-2 rounded-xl bg-foreground/5 px-3 py-2 text-sm">
                <strong className="tabular-nums text-[var(--analytics-red)]">{k.count}</strong>
                <span>{k.label}</span>
                <span className="text-xs text-muted-foreground">{k.people === 1 ? "1 person" : `${k.people} people`}</span>
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {edges.recent.map((e, i) => (
                  <tr key={`${e.at}-${i}`} className="border-t border-foreground/5 align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{when(e.at)}</td>
                    <td className="py-1.5 pr-3">{e.username ?? "–"}</td>
                    <td className="py-1.5 pr-3">{e.label}</td>
                    <td className="py-1.5 text-muted-foreground">{e.detail ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
