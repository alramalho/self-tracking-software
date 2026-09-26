import { Image, Pressable, View } from "react-native";
import { CalendarCheck, Check, Compass, Minus, TrendingUp } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { useCurrentUser } from "@/data/queries";
import { coachIdentity } from "@/features/messages/coach";
import { PreviewButton, PreviewSheet } from "@/features/messages/entities/PreviewSheet";
import type { CoachingPlan, FreeTrackingSheetProps, PaywallProps } from "./types";

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

// What coaching changes, not what it contains.
const IMPACT = [
  { icon: Compass, text: "A plan that adjusts when life gets busy" },
  { icon: CalendarCheck, text: "A nudge before a week slips, not after" },
  { icon: TrendingUp, text: "An honest weekly review of what's working" },
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
export function Paywall({ facts, plans, selected, onSelect }: PaywallProps) {
  const c = useColors();
  const coach = coachIdentity(useCurrentUser().data?.coachPersonality);
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
    <View testID="coaching-paywall" style={{ gap: 22 }}>
      {/* 1. Social proof: real members. */}
      <View style={{ alignItems: "center", gap: 10 }}>
        <View style={{ flexDirection: "row" }}>
          {[
            ...MEMBERS.map((uri) => ({ uri })),
            coach.name === "Oli" ? require("../../../assets/coaches/oli.png") : require("../../../assets/coaches/helly.png"),
          ].map((source, i) => (
            <Image
              key={i}
              source={source}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                marginLeft: i ? -12 : 0,
                borderWidth: 2,
                borderColor: c.bg,
                backgroundColor: c.soft,
              }}
            />
          ))}
        </View>
        <Text style={{ color: c.muted, fontSize: 13, textAlign: "center", fontStyle: "italic" }}>
          “{QUOTE.text}” — {QUOTE.name}
        </Text>
      </View>

      {/* 2. The vision, in their own words. */}
      <View style={{ alignItems: "center", gap: 8 }}>
        <Text style={{ color: c.accent, fontSize: 13, fontWeight: "700", letterSpacing: 0.4 }}>
          {coach.name.toUpperCase()} WILL GET YOU THERE
        </Text>
        <Text
          accessibilityRole="header"
          style={{ color: c.text, fontSize: 23, lineHeight: 29, fontWeight: "700", textAlign: "center", letterSpacing: -0.4 }}
        >
          {facts.emoji} {facts.goal}
        </Text>
        {!!facts.goalReason && (
          <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22, textAlign: "center", fontStyle: "italic" }}>
            “{facts.goalReason}”
          </Text>
        )}
      </View>

      {/* 3. Impact. */}
      <View style={{ gap: 12, paddingHorizontal: 8 }}>
        {IMPACT.map(({ icon: Icon, text }) => (
          <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Icon size={20} color={c.accent} />
            <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{text}</Text>
          </View>
        ))}
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
              accessibilityLabel={`${LABELS[plan.id]}, ${money(plan)} per ${period(plan)}`}
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
                {money(plan)}/{period(plan).replace(/^1 /, "")}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Checked against the app: reminders, streaks, friends and Apple Health work without a subscription.
const FREE_KEEPS = [
  "Your plan, streaks and progress",
  "Reminders at the times you choose",
  "Friends, the feed and reactions",
  "Apple Health workouts and sleep",
];
const COACH_ADDS = [
  "A weekly review of what's working",
  "A nudge before a week slips",
  "Plan changes when life gets busy",
];

/** Before tracking for free: what you keep, what the coach would add, and one more look at the trial. */
export function FreeTrackingSheet({ visible, plan, busy, onTrial, onFree, onClose }: FreeTrackingSheetProps) {
  const c = useColors();
  const coach = coachIdentity(useCurrentUser().data?.coachPersonality);
  const row = (Icon: typeof Check, text: string, color: string) => (
    <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Icon size={17} color={color} />
      <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{text}</Text>
    </View>
  );
  return (
    <PreviewSheet visible={visible} title="Track on your own" onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 36 }}>
        <Image
          source={coach.name === "Oli" ? require("../../../assets/coaches/oli.png") : require("../../../assets/coaches/helly.png")}
          style={{ width: 40, height: 40 }}
        />
        <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>
          No problem, your plan is ready either way.
        </Text>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>FREE, FOREVER</Text>
        {FREE_KEEPS.map((text) => row(Check, text, "#22c55e"))}
      </View>
      <View style={{ gap: 10 }}>
        <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>WHAT {coach.name.toUpperCase()} WOULD ADD</Text>
        {COACH_ADDS.map((text) => row(Minus, text, c.muted))}
      </View>
      <Text style={{ color: c.muted, fontSize: 13 }}>You can add coaching to any plan later.</Text>
      <PreviewButton
        label={plan?.trialDays ? `Try ${coach.name} free for ${plan.trialDays} days` : `Start coaching with ${coach.name}`}
        disabled={busy}
        onPress={onTrial}
      />
      <PreviewButton secondary label="Track for free" disabled={busy} onPress={onFree} />
    </PreviewSheet>
  );
}
