import { Clock, Dumbbell, Footprints, Gauge, Target } from "lucide-react";
import { useState } from "react";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { SessionDetailProps, SessionTargetRowsProps, TargetRowProps, TwoWeeksProps } from "../types";
import { addDay, dayNumber, liftText, longDate, paceText, sessionsOn, unitLabel, weekRange, weekday } from "./format";

function TargetRow({ icon: Icon, children }: TargetRowProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.8} />
      <span className="text-[15px] leading-[21px] text-foreground">{children}</span>
    </div>
  );
}

// What a session asks for, in numbers: time, effort and pace (or sets, reps and load), and how you'll know it worked.
function SessionTargetRows({ targets }: SessionTargetRowsProps) {
  const pace = paceText(targets);
  const lift = liftText(targets);
  return (
    <div data-testid="session-targets" className="flex flex-col gap-2.5">
      <TargetRow icon={Clock}>{`${targets.durationMinutes} min`}</TargetRow>
      <TargetRow icon={Gauge}>{targets.effort}</TargetRow>
      {pace && <TargetRow icon={Footprints}>{pace}</TargetRow>}
      {lift && <TargetRow icon={Dumbbell}>{`${targets.exercise ? `${targets.exercise} · ` : ""}${lift}`}</TargetRow>}
      <TargetRow icon={Target}>{targets.progressMeasure}</TargetRow>
    </div>
  );
}

function SessionDetail({ session, activity }: SessionDetailProps) {
  return (
    <div data-testid="session-detail" className="flex flex-col gap-3 rounded-[18px] bg-card p-[18px]">
      <div className="flex flex-col gap-0.5">
        <span className="text-lg font-bold text-foreground">
          {activity.emoji} {session.title}
        </span>
        <span className="text-sm text-muted-foreground">
          {longDate(session.date)} · {session.quantity} {unitLabel(activity.measure, session.quantity)}
        </span>
      </div>
      <SessionTargetRows targets={session.targets} />
      <p className="text-sm leading-5 text-muted-foreground">{session.descriptiveGuide}</p>
    </div>
  );
}

// The first two weeks as two calendar rows. Tap a day to open it; rest days open too.
export function TwoWeeks({ sessions, activity, startDate }: TwoWeeksProps) {
  const theme = useThemeColors();
  const [day, setDay] = useState(sessions[0]?.date ?? startDate);
  const selected = sessionsOn(sessions, day);
  return (
    <div data-testid="two-weeks" className="flex flex-col gap-3.5">
      {[0, 1].map((week) => {
        const from = addDay(startDate, week * 7);
        return (
          <div key={week} className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">
              Week {week + 1} · {weekRange(from)}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: 7 }, (_, i) => {
                const date = addDay(from, i);
                const here = sessionsOn(sessions, date);
                const active = date === day;
                return (
                  <button
                    key={date}
                    type="button"
                    data-testid={`day-${date}`}
                    aria-label={`${longDate(date)}${here.length ? `, ${here.map((s) => s.title).join(", ")}` : ", rest day"}`}
                    aria-pressed={active}
                    onClick={() => setDay(date)}
                    className={`flex min-h-[76px] min-w-0 flex-1 flex-col items-center gap-1 rounded-[10px] bg-card py-2 ${
                      active ? `border-2 ${theme.border}` : "border border-border"
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-muted-foreground">{weekday(date).toUpperCase()}</span>
                    <span className="text-[15px] font-bold text-foreground">{dayNumber(date)}</span>
                    {here.map((session, n) => (
                      <span key={n} className="text-xs text-foreground">
                        {activity.emoji}
                        {session.quantity}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {selected.length ? (
        selected.map((session, i) => <SessionDetail key={i} session={session} activity={activity} />)
      ) : (
        <div data-testid="rest-day" className="flex flex-col gap-0.5 rounded-[18px] bg-card p-[18px]">
          <span className="text-lg font-bold text-foreground">Rest day</span>
          <span className="text-sm text-muted-foreground">{longDate(day)}</span>
        </div>
      )}
    </div>
  );
}
