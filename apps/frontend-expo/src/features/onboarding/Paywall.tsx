import { Image, Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { useCurrentUser } from "@/data/queries";
import { coachIdentity } from "@/features/messages/coach";
import { StepSequence } from "./interview/StepReveal";
import type { CoachingPlan, PaywallProps } from "./types";

// Real members who agreed to appear on tracking.so (same testimonials as the website).
const MEMBERS = [
  "https://images.clerk.dev/uploaded/img_2rLRJg6VPMlYuMVZYQnhAQFSOV2",
  "https://images.clerk.dev/oauth_google/img_2owSQjN6MO3damiIczdK5NZ0uAl",
  "https://images.clerk.dev/uploaded/img_32NkwXivj1KFqbdpkkk3IpHjnjB",
];
const QUOTE = {
  text: "It keeps me motivated to keep going and accountable to my goals",
  name: "Barbara",
};

// What stays either way, and what the coach adds. Same facts for everyone; the grey checks show the gap
// without naming a loss. Reminders, streaks, friends and Apple Health are free (checked against the app).
type Row = { text: string; free: boolean };
const OUTCOME_ROWS: Row[] = [
  { text: "Two weeks, pace, targets", free: true },
  { text: "Reminders, streaks, friends", free: true },
  { text: "Next weeks planned as you go", free: false },
  { text: "Lighter week after a hard one", free: false },
  { text: "Nudge before a week slips", free: false },
  { text: "Weekly review", free: false },
];
const HABIT_ROWS: Row[] = [
  { text: "Your habit and streaks", free: true },
  { text: "Reminders, friends, Health", free: true },
  { text: "Target adjusts as weeks go", free: false },
  { text: "Nudge before a week slips", free: false },
  { text: "Weekly review", free: false },
];

const LABELS: Record<CoachingPlan["id"], string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const WEEKS_PER = { day: 1 / 7, week: 1, month: 52 / 12, year: 52 } as Record<string, number>;

export const weeksIn = (plan: CoachingPlan) => (WEEKS_PER[plan.interval] ?? 1) * plan.intervalCount;

export const money = (plan: CoachingPlan, amount = plan.amount) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: plan.currency }).format(amount / 100);
// The store's own price text when there is one (App Store), so it matches the purchase sheet.
export const price = (plan: CoachingPlan) => plan.displayPrice ?? money(plan);

const period = (plan: CoachingPlan) =>
  plan.intervalCount === 3 && plan.interval === "month"
    ? "3 months"
    : plan.intervalCount > 1
      ? `${plan.intervalCount} ${plan.interval}s`
      : plan.interval;

/** Button text for the chosen plan: the trial is the promise, otherwise the start. */
export const paywallCta = (plan?: CoachingPlan) =>
  plan?.trialDays ? `Start my ${plan.trialDays} free days` : "Start coaching";

/** The coaching paywall: who's in, the person's own goal, what changes, and the plans. */
export function Paywall({ facts, plans, selected, onSelect, coach: chosenCoach }: PaywallProps) {
  const c = useColors();
  const account = coachIdentity(useCurrentUser().data?.coachPersonality);
  // The route chosen in onboarding names the coach, because that is who the plan was built by.
  const coach = chosenCoach ? { ...account, name: chosenCoach } : account;
  const coachName = coach.name;
  const weekly = plans.find((plan) => plan.id === "weekly");
  const saving = (plan: CoachingPlan) =>
    weekly && plan.id !== "weekly"
      ? Math.round((1 - plan.amount / weeksIn(plan) / weekly.amount) * 100)
      : 0;
  const best = plans.reduce<CoachingPlan | undefined>(
    (top, plan) => (saving(plan) > (top ? saving(top) : 0) ? plan : top),
    undefined,
  );

  return (
    <StepSequence prefix="paywall" testID="coaching-paywall" style={{ gap: 14 }}>
      {/* 2. The vision, in their own words. */}
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text style={{ color: c.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 }}>
          {coach.name.toUpperCase()} WILL GET YOU THERE
        </Text>
        <Text
          accessibilityRole="header"
          style={{ color: c.text, fontSize: 21, lineHeight: 26, fontWeight: "700", textAlign: "center", letterSpacing: -0.4 }}
        >
          {facts.emoji} {facts.goal}
        </Text>
        {!!facts.goalReason && (
          <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22, textAlign: "center", fontStyle: "italic" }}>
            “{facts.goalReason}”
          </Text>
        )}
      </View>

      {/* 3. What you keep, and what the coach adds. */}
      <View testID="paywall-compare" style={{ backgroundColor: c.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
          <View style={{ flex: 1 }} />
          <Text style={{ width: 62, textAlign: "center", color: c.muted, fontSize: 11, lineHeight: 14, fontWeight: "700" }}>On your own</Text>
          <Text style={{ width: 62, textAlign: "center", color: c.muted, fontSize: 11, lineHeight: 14, fontWeight: "700" }}>With {coachName}</Text>
        </View>
        {(facts.coachingRole === "consistency" ? HABIT_ROWS : OUTCOME_ROWS).map((row) => (
          <View key={row.text} style={{ flexDirection: "row", alignItems: "center", minHeight: 34, borderTopWidth: 1, borderColor: c.border }}>
            <Text style={{ flex: 1, color: c.text, fontSize: 14, lineHeight: 18, paddingVertical: 6, paddingRight: 6 }}>{row.text}</Text>
            <View accessibilityLabel={row.free ? "Included" : "Not included"} style={{ width: 62, alignItems: "center" }}>
              <Check size={18} strokeWidth={3} color={row.free ? c.accent : c.muted} style={{ opacity: row.free ? 1 : 0.4 }} />
            </View>
            <View accessibilityLabel="Included" style={{ width: 62, alignItems: "center" }}>
              <Check size={18} strokeWidth={3} color={c.accent} />
            </View>
          </View>
        ))}
      </View>

      {/* 1. Social proof: real members. */}
      <View style={{ alignItems: "center", gap: 6 }}>
        <View style={{ flexDirection: "row" }}>
          {[
            ...MEMBERS.map((uri) => ({ uri })),
            coach.name === "Oli" ? require("../../../assets/coaches/oli-3d.png") : require("../../../assets/coaches/helly-3d.png"),
          ].map((source, i) => (
            <Image
              key={i}
              source={source}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                marginLeft: i ? -10 : 0,
                borderWidth: 2,
                borderColor: c.bg,
                backgroundColor: c.soft,
              }}
            />
          ))}
        </View>
        <Text style={{ color: c.muted, fontSize: 12, textAlign: "center", fontStyle: "italic" }}>
          “{QUOTE.text}” — {QUOTE.name}
        </Text>
      </View>

      {/* 4. Plans, best value preselected. */}
      <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
        {plans.map((plan) => {
          const active = plan.id === selected;
          const save = plan.id === best?.id ? saving(plan) : 0;
          return (
            <Pressable
              key={plan.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              aria-checked={active}
              accessibilityLabel={`${LABELS[plan.id]}, ${price(plan)} per ${period(plan)}`}
              onPress={() => onSelect(plan.id)}
              style={{
                borderRadius: 16,
                borderWidth: active ? 2 : 1,
                borderColor: active ? c.accent : c.border,
                backgroundColor: c.card,
                paddingVertical: 14,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              {save > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -11,
                    alignSelf: "center",
                    left: 0,
                    right: 0,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      backgroundColor: "#16a34a",
                      color: "white",
                      fontSize: 11,
                      fontWeight: "700",
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    Save {save}% vs weekly
                  </Text>
                </View>
              )}
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: active ? c.accent : c.muted,
                  backgroundColor: active ? c.accent : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {active && <Check size={13} color="white" strokeWidth={3} />}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{LABELS[plan.id]}</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {[
                    plan.trialDays ? `${plan.trialDays} days free` : null,
                    plan.id !== "weekly" ? `${money(plan, plan.amount / weeksIn(plan))}/week` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Cancel anytime"}
                </Text>
              </View>
              <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>
                {price(plan)}/{period(plan).replace(/^1 /, "")}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </StepSequence>
  );
}
