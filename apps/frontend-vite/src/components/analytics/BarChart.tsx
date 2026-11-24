export type Bar = { key: string; title: string; segments: { value: number; color: string }[] };

const short = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
const isSunday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay() === 0;
const weekday = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });

/** Daily bars, stacked by segment; Sundays shaded so weeks are easy to read. */
export function BarChart({ bars, maxLabel }: { bars: Bar[]; maxLabel?: (max: number) => string }) {
  const max = Math.max(1, ...bars.map((b) => b.segments.reduce((n, s) => n + s.value, 0)));
  return (
    <div>
      <span className="text-xs text-muted-foreground">{maxLabel ? maxLabel(max) : Math.round(max)}</span>
      <div className="flex h-36 items-end border-b border-foreground/10" style={{ gap: bars.length > 60 ? 1 : 3 }}>
        {bars.map((b) => (
          <div
            key={b.key}
            title={`${weekday(b.key)} ${b.title}`}
            className={`flex h-full flex-1 flex-col-reverse rounded-t-sm ${isSunday(b.key) ? "bg-foreground/5" : ""}`}
          >
            {b.segments.map((s, i) =>
              s.value > 0 ? (
                <div key={i} className="first:rounded-none last:rounded-t-sm" style={{ height: `${(100 * s.value) / max}%`, background: s.color }} />
              ) : null,
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{bars[0] && short(bars[0].key)}</span>
        {bars.some((b) => isSunday(b.key)) && <span>shaded = Sunday</span>}
        <span>{bars.length > 0 && short(bars[bars.length - 1].key)}</span>
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-foreground/5 p-0.5 text-sm" role="group">
      {options.map((o) => (
        <button
          key={String(o.value)}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 ${o.value === value ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1">
          <i className="inline-block size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </span>
  );
}
