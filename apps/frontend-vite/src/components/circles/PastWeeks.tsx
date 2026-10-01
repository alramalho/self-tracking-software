import AppleLikePopover from "@/components/AppleLikePopover";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CirclePanel } from "./components";
import { barShare, barTotal, circleTarget, firstName, pastWeeksLine, personColors, weekBars } from "./model";
import type { PastWeeksChartProps, PastWeeksRowProps, PastWeeksSheetProps } from "./types";

const CHART_HEIGHT = 170;
const TOP = 26;
const BOTTOM = 22;
const BAR_GAP = 12;
const MUTED = "var(--color-muted-foreground)";

// The circle page row: a tiny bar per finished week, the streak together and where you stand.
export function PastWeeksRow({ board, viewerId, onPress }: PastWeeksRowProps) {
  const theme = useThemeColors();
  const past = board.pastWeeks;
  if (!past) return null;
  const mine = past.ranking.find((row) => row.userId === viewerId);
  return (
    <button type="button" onClick={onPress} className="text-left transition-opacity hover:opacity-70">
      <CirclePanel className="flex items-center gap-3">
        <div className="flex h-[30px] items-end gap-[3px]" aria-hidden>
          {weekBars(past, board.members)
            .filter((bar) => !bar.current)
            .map((bar) => (
              <span
                key={bar.key}
                className="w-[7px] rounded-[2px]"
                style={{
                  height: Math.max(3, 30 * barShare(bar)),
                  backgroundColor: bar.allHit ? theme.hex : MUTED,
                  opacity: bar.allHit ? 1 : 0.45,
                }}
              />
            ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">Past weeks</p>
          <p className="text-sm text-muted-foreground">{pastWeeksLine(board.togetherStreak, mine?.percent)}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </CirclePanel>
    </button>
  );
}

// Stacked bars: the circle's sessions each week, one colour per person, against the
// dashed line of everyone's targets added up. The week in progress is faded and outlined.
function Chart({ bars, colors, highlight }: PastWeeksChartProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => setWidth(box.clientWidth));
    observer.observe(box);
    setWidth(box.clientWidth);
    return () => observer.disconnect();
  }, []);

  const target = circleTarget(bars);
  const tallest = Math.max(target, ...bars.map(barTotal), 1);
  const unit = (CHART_HEIGHT - TOP - BOTTOM) / tallest;
  const base = CHART_HEIGHT - BOTTOM;
  const barWidth = Math.min(34, (width - BAR_GAP * (bars.length + 1)) / bars.length);
  const left = (width - (barWidth * bars.length + BAR_GAP * (bars.length - 1))) / 2;
  const targetY = base - target * unit;
  return (
    <div ref={boxRef} style={{ height: CHART_HEIGHT }}>
      {width > 0 && (
        <svg
          width={width}
          height={CHART_HEIGHT}
          role="img"
          aria-label={`Sessions each week by person, against the circle target of ${target}`}
        >
          {target > 0 && (
            <line x1={0} x2={width} y1={targetY} y2={targetY} stroke={MUTED} strokeWidth={1} strokeDasharray="4 4" />
          )}
          {bars.map((bar, i) => {
            const x = left + i * (barWidth + BAR_GAP);
            let y = base;
            return (
              <g key={bar.key}>
                {bar.segments.map((segment) => {
                  const height = segment.done * unit;
                  y -= height;
                  const dimmed = highlight && highlight !== segment.userId;
                  return height > 0 ? (
                    <rect
                      key={segment.userId}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(1, height - 2)}
                      rx={3}
                      fill={colors[segment.userId] ?? MUTED}
                      opacity={dimmed ? 0.25 : bar.current ? 0.4 : 1}
                    />
                  ) : null;
                })}
                {bar.current && target > 0 && (
                  <rect
                    x={x - 0.5}
                    y={targetY}
                    width={barWidth + 1}
                    height={base - targetY}
                    rx={4}
                    fill="none"
                    stroke={MUTED}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                )}
                {bar.allHit && (
                  <text x={x + barWidth / 2} y={y - 6} fontSize={13} textAnchor="middle">
                    🔥
                  </text>
                )}
                <text
                  x={x + barWidth / 2}
                  y={base + 15}
                  fontSize={11}
                  fontWeight={bar.current ? 700 : 400}
                  fill={bar.current ? "var(--color-foreground)" : MUTED}
                  textAnchor="middle"
                >
                  {bar.label}
                </text>
              </g>
            );
          })}
          {target > 0 && (
            // Drawn last with a background halo, so it stays readable over a tall bar.
            <text
              x={width}
              y={targetY - 5}
              fontSize={10}
              fill={MUTED}
              textAnchor="end"
              stroke="var(--color-background)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {`circle target ${target}`}
            </text>
          )}
        </svg>
      )}
    </div>
  );
}

// Together first (the bars against the circle's target), then the friendly race:
// everyone ranked by the share of their own target, so paces compare fairly.
export function PastWeeksSheet({ board, viewerId, open, onClose }: PastWeeksSheetProps) {
  const [highlight, setHighlight] = useState<string>();
  const past = board.pastWeeks;
  if (!past) return null;
  const colors = personColors(board.members);
  const count = past.weeks.length;
  return (
    <AppleLikePopover open={open} onClose={onClose} title="Past weeks">
      <div data-testid="past-weeks-sheet" className="flex flex-col gap-3 pt-2">
        <div className="flex items-baseline justify-between pr-10">
          <h2 className="text-xl font-bold text-foreground">Past weeks</h2>
          <p className="text-sm text-muted-foreground">{`last ${count} ${count === 1 ? "week" : "weeks"}`}</p>
        </div>
        <Chart bars={weekBars(past, board.members)} colors={colors} highlight={highlight} />
        <div className="flex items-baseline justify-between">
          <p className="text-base font-semibold text-foreground">Most consistent</p>
          <p className="text-sm text-muted-foreground">% of own target</p>
        </div>
        <div className="flex flex-col">
          {past.ranking.map((row) => {
            const member = board.members.find((m) => m.user.id === row.userId);
            if (!member) return null;
            const color = colors[row.userId];
            const name = row.userId === viewerId ? "You" : firstName(member.user);
            return (
              <button
                key={row.userId}
                type="button"
                aria-label={`${name}, ${row.percent}% of own target`}
                aria-pressed={highlight === row.userId}
                onClick={() => setHighlight(highlight === row.userId ? undefined : row.userId)}
                className={cn(
                  "flex items-center gap-2.5 py-2 text-left transition-opacity",
                  highlight && highlight !== row.userId && "opacity-45"
                )}
              >
                <span className="w-3.5 text-sm tabular-nums text-muted-foreground">{row.rank}</span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">{name}</span>
                <span className="flex gap-[3px]" aria-hidden>
                  {row.hits.map((hit, i) => (
                    <span
                      key={past.weeks[i].start}
                      className={cn("h-[11px] w-[11px] rounded-[3px]", hit === false && "bg-muted-foreground/25")}
                      style={hit ? { backgroundColor: color } : undefined}
                    />
                  ))}
                </span>
                <span className="w-[46px] text-right text-[15px] font-semibold tabular-nums text-foreground">
                  {`${row.percent}%`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">A square fills when you hit your week.</p>
      </div>
    </AppleLikePopover>
  );
}
