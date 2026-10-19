import { Check } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { CoachingPlan, PaywallProps, PaywallRow } from "../types";
import { LABELS, money, period, savingVsWeekly, weeksIn } from "./plans";

// Real members who agreed to appear on tracking.so (the same as the app and the website).
const MEMBERS = [
  "https://images.clerk.dev/uploaded/img_2rLRJg6VPMlYuMVZYQnhAQFSOV2",
  "https://images.clerk.dev/oauth_google/img_2owSQjN6MO3damiIczdK5NZ0uAl",
  "https://images.clerk.dev/uploaded/img_32NkwXivj1KFqbdpkkk3IpHjnjB",
];
const QUOTE = { text: "It keeps me motivated to keep going and accountable to my goals", name: "Barbara" };

// What stays either way, and what the coach adds. The grey checks show the gap without naming a loss.
const OUTCOME_ROWS: PaywallRow[] = [
  { text: "Two weeks, pace, targets", free: true },
  { text: "Reminders, streaks, friends", free: true },
  { text: "Next weeks planned as you go", free: false },
  { text: "Lighter week after a hard one", free: false },
  { text: "Nudge before a week slips", free: false },
  { text: "Weekly review", free: false },
];
const HABIT_ROWS: PaywallRow[] = [
  { text: "Your habit and streaks", free: true },
  { text: "Reminders, friends, Health", free: true },
  { text: "Target adjusts as weeks go", free: false },
  { text: "Nudge before a week slips", free: false },
  { text: "Weekly review", free: false },
];

// The coaching paywall: the person's own goal, what changes with a coach, who's in, and the plans.
export function Paywall({ facts, plans, selected, onSelect, coach }: PaywallProps) {
  const theme = useThemeColors();
  const best = plans.reduce<CoachingPlan | undefined>(
    (top, plan) => (savingVsWeekly(plan, plans) > (top ? savingVsWeekly(top, plans) : 0) ? plan : top),
    undefined,
  );
  return (
    <div data-testid="coaching-paywall" className="flex flex-col gap-3.5">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className={`text-xs font-bold tracking-[0.03em] ${theme.text}`}>{coach.toUpperCase()} WILL GET YOU THERE</span>
        <h1 className="text-balance text-[21px] font-bold leading-[26px] tracking-[-0.02em] text-foreground">
          {facts.emoji} {facts.goal}
        </h1>
        {!!facts.goalReason && <p className="text-[15px] italic leading-[22px] text-muted-foreground">“{facts.goalReason}”</p>}
      </div>

      <div data-testid="paywall-compare" className="rounded-[18px] bg-card px-3.5 py-1">
        <div className="flex items-center py-1.5">
          <span className="flex-1" />
          <span className="w-[62px] text-center text-[11px] font-bold leading-[14px] text-muted-foreground">On your own</span>
          <span className="w-[62px] text-center text-[11px] font-bold leading-[14px] text-muted-foreground">With {coach}</span>
        </div>
        {(facts.coachingRole === "consistency" ? HABIT_ROWS : OUTCOME_ROWS).map((row) => (
          <div key={row.text} className="flex min-h-[34px] items-center border-t border-border">
            <span className="flex-1 py-1.5 pr-1.5 text-sm leading-[18px] text-foreground">{row.text}</span>
            <span aria-label={row.free ? "Included" : "Not included"} className="flex w-[62px] justify-center">
              <Check className={`h-[18px] w-[18px] ${row.free ? theme.text : "text-muted-foreground opacity-40"}`} strokeWidth={3} />
            </span>
            <span aria-label="Included" className="flex w-[62px] justify-center">
              <Check className={`h-[18px] w-[18px] ${theme.text}`} strokeWidth={3} />
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <div className="flex">
          {[...MEMBERS, coach === "Oli" ? "/images/onboarding/oli-3d.png" : "/images/onboarding/helly-3d.png"].map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              className={`h-[34px] w-[34px] rounded-full border-2 border-background bg-muted object-cover ${i ? "-ml-2.5" : ""}`}
            />
          ))}
        </div>
        <p className="text-center text-xs italic text-muted-foreground">
          “{QUOTE.text}” — {QUOTE.name}
        </p>
      </div>

      <div role="radiogroup" aria-label="Coaching plan" className="flex flex-col gap-2.5 pt-1">
        {plans.map((plan) => {
          const active = plan.id === selected;
          const save = plan.id === best?.id ? savingVsWeekly(plan, plans) : 0;
          return (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${LABELS[plan.id]}, ${money(plan)} per ${period(plan)}`}
              onClick={() => onSelect(plan.id)}
              className={`relative flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left ${active ? `border-2 ${theme.border}` : "border border-border"}`}
            >
              {save > 0 && (
                <span className="absolute -top-[11px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-green-600 px-2.5 py-[3px] text-[11px] font-bold text-white">
                  Save {save}% vs weekly
                </span>
              )}
              <span
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${
                  active ? `${theme.border} ${theme.bg}` : "border-muted-foreground"
                }`}
              >
                {active && <Check className="h-[13px] w-[13px] text-white" strokeWidth={3} />}
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-base font-semibold text-foreground">{LABELS[plan.id]}</span>
                <span className="text-xs text-muted-foreground">
                  {[plan.trialDays ? `${plan.trialDays} days free` : null, plan.id !== "weekly" ? `${money(plan, plan.amount / weeksIn(plan))}/week` : null]
                    .filter(Boolean)
                    .join(" · ") || "Cancel anytime"}
                </span>
              </span>
              <span className="text-[15px] font-semibold text-foreground">
                {money(plan)}/{period(plan).replace(/^1 /, "")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
