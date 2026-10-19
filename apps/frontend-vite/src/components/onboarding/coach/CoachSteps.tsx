import { Activity, Check, Moon } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { CoachAvatar } from "../frame/controls";
import type { CoachingChoiceProps, CoachStepProps, ExampleCardProps } from "../types";

const titles = ["A coach for this plan.", "A timely check-in.", "You choose what it can see."];
const details = [
  "See a first step, session explanations and changes for your approval.",
  "Questions and proposals open in Messages.",
  "Choose the watch summaries your coach may use for this plan.",
];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ExampleCard({ label, children }: ExampleCardProps) {
  const theme = useThemeColors();
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] bg-card p-5">
      <span className={`text-xs font-bold tracking-[0.05em] ${theme.text}`}>{label}</span>
      <p className="text-[17px] leading-[25px] text-foreground">{children}</p>
    </div>
  );
}

// A labelled row with a checkmark when it's on.
function CoachingChoice({ label, detail, selected, icon: Icon, onClick }: CoachingChoiceProps) {
  const theme = useThemeColors();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 border-b border-border py-3 text-left"
    >
      {Icon && <Icon className={`h-[22px] w-[22px] shrink-0 ${theme.text}`} strokeWidth={1.7} />}
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-[17px] text-foreground">{label}</span>
        <span className="text-[15px] leading-[21px] text-muted-foreground">{detail}</span>
      </span>
      {selected && <Check className="h-[23px] w-[23px] shrink-0 text-foreground" />}
    </button>
  );
}

// The coach introduces itself and what it will do. The plan already decided its role,
// so these screens only set how often it speaks up and what it may see.
export function CoachStep({ step, coach, facts, coaching, preferences, onCoaching, onPreferences }: CoachStepProps) {
  const theme = useThemeColors();
  const training = coaching.role === "training";
  return (
    <div data-testid={["coach-tour-role", "coach-tour-contact", "coach-tour-data"][step]} className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-col items-center gap-1">
          <CoachAvatar coach={coach} size={64} />
          <span className="text-[13px] font-semibold text-muted-foreground">{coach} · your coach</span>
        </div>
        <h1 className="text-[27px] font-bold leading-[33px] tracking-[-0.02em] text-foreground">{titles[step]}</h1>
        <p className="text-base leading-6 text-muted-foreground">{details[step]}</p>
      </div>

      {step === 0 && (
        <ExampleCard label="EXAMPLE · YOUR PLAN">
          {training
            ? "“Your first two weeks are set. I’ll plan the next ones from how these go.”"
            : "“I’ll check in when a week slips, and help you pick it back up.”"}
        </ExampleCard>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-3.5">
          <ExampleCard label="EXAMPLE · AFTER A DIFFICULT WEEK">“Hard week. Should we keep the plan or make it lighter?”</ExampleCard>
          <div>
            <CoachingChoice
              label="Weekly review"
              detail="One message at the day and time you choose."
              selected={preferences.weeklyReview}
              onClick={() => onPreferences({ ...preferences, weeklyReview: !preferences.weeklyReview })}
            />
            {preferences.weeklyReview && (
              <div className="flex flex-col gap-3 py-3">
                <div className="flex gap-1.5" role="radiogroup" aria-label="Review day">
                  {weekdays.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={preferences.reviewDay === index}
                      onClick={() => onPreferences({ ...preferences, reviewDay: index })}
                      className={`h-10 min-w-0 flex-1 rounded-xl text-[13px] font-semibold ${
                        preferences.reviewDay === index ? `border-2 ${theme.border} text-foreground` : "border border-border text-muted-foreground"
                      } bg-card`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="time"
                  aria-label={`Review time ${preferences.reviewTime}`}
                  value={preferences.reviewTime}
                  onChange={(e) => e.target.value && onPreferences({ ...preferences, reviewTime: e.target.value })}
                  className="h-11 rounded-xl border border-border bg-card px-3 text-[15px] text-foreground"
                />
              </div>
            )}
            <CoachingChoice
              label="Follow up when useful"
              detail={
                training
                  ? "Asks after each planned session. No reply counts as missed, and next week adapts."
                  : "One reminder, then a nudge about why you started before offering to archive."
              }
              selected={coaching.followUps}
              onClick={() => onCoaching({ ...coaching, followUps: !coaching.followUps })}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3.5">
          <ExampleCard label={training ? "EXAMPLE · WITH WORKOUT ACCESS" : "EXAMPLE · FROM THIS PLAN'S LOGS"}>
            {training
              ? "“I can see yesterday’s workout. Did it feel comfortable enough to repeat?”"
              : `“I saw a ${facts.activityTitle.toLowerCase()} session logged this week. How did it go?”`}
          </ExampleCard>
          <div>
            <CoachingChoice
              icon={Activity}
              label="Watch workouts"
              detail="Apple Health or Garmin: distance, duration and heart rate."
              selected={coaching.dataAccess.workouts}
              onClick={() => onCoaching({ ...coaching, dataAccess: { ...coaching.dataAccess, workouts: !coaching.dataAccess.workouts } })}
            />
            <CoachingChoice
              icon={Moon}
              label="Sleep summaries"
              detail="Duration and score, when available."
              selected={coaching.dataAccess.sleep}
              onClick={() => onCoaching({ ...coaching, dataAccess: { ...coaching.dataAccess, sleep: !coaching.dataAccess.sleep } })}
            />
          </div>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Selected data goes to the external AI services used by your coach. You can change this in the plan later. Turning access off stops future
            retrieval; earlier messages remain.
          </p>
        </div>
      )}
    </div>
  );
}
