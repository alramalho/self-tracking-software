import { View } from "react-native";
import { format, parseISO } from "date-fns";
import { ArrowRight, CalendarDays } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { usePlans } from "@/data/queries";
import type {
  ChangeHeroProps,
  PlanProposalDetailsProps,
  ProposalOperation,
  ProposalPatch,
} from "./types";
import type { CoachMood } from "./adaptation/types";

/** Plan setup fields that read best as a big before → after, not as a list row. */
export const heroFields = ["timesPerWeek", "finishingDate", "goal"] as const;

const endDate = (date?: string | Date | null) =>
  date
    ? format(typeof date === "string" ? parseISO(date.slice(0, 10)) : date, "MMM d")
    : "No end date";

/** The proposed plan setup change, from either the patch or the legacy operations. */
export const proposedPlanSetup = (
  proposal: PlanProposalDetailsProps["proposal"],
): Partial<ProposalOperation> | undefined =>
  (proposal.patch as ProposalPatch | undefined)?.plan ??
  (proposal.operations as ProposalOperation[] | undefined)?.find(
    (op) => op.type === "update_plan",
  );

/** One number in a tile; the new one is lit in the accent colour. */
function NumberTile({ value, lit }: { value: string; lit?: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        minWidth: 92,
        height: 92,
        paddingHorizontal: 14,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: lit ? 2 : 1,
        borderColor: lit ? c.accent : c.border,
        backgroundColor: lit ? c.selectedBg : c.soft,
      }}
    >
      <Text
        style={{
          fontSize: 56,
          lineHeight: 64,
          fontWeight: "800",
          color: lit ? c.accent : c.muted,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/** A big "6 → 5" with what it measures underneath. */
export function ChangeHero({ from, to, caption, size = "large" }: ChangeHeroProps) {
  const c = useColors();
  const changed = from !== undefined && from !== to;
  if (size === "large")
    return (
      <View testID="change-hero" style={{ alignItems: "center", gap: 10, paddingVertical: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {changed && <NumberTile value={from!} />}
          {changed && (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.soft,
              }}
            >
              <ArrowRight size={22} color={c.text} strokeWidth={2.4} />
            </View>
          )}
          <NumberTile value={to} lit />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <CalendarDays size={16} color={c.muted} strokeWidth={2} />
          <Text style={{ fontSize: 14, color: c.muted, fontWeight: "600" }}>{caption}</Text>
        </View>
      </View>
    );
  const stacked = to.length > 14 || (from?.length ?? 0) > 14;
  return (
    <View style={{ alignItems: "center", gap: 2, paddingVertical: 4 }}>
      <View
        style={{
          flexDirection: stacked ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: stacked ? 4 : 14,
        }}
      >
        {changed && (
          <Text
            style={{
              fontSize: stacked ? 16 : 26,
              fontWeight: "800",
              color: c.muted,
              textAlign: "center",
              textDecorationLine: stacked ? "line-through" : "none",
              fontVariant: ["tabular-nums"],
            }}
          >
            {from}
          </Text>
        )}
        {changed && !stacked && <ArrowRight size={20} color={c.muted} />}
        <Text
          style={{
            fontSize: stacked ? 20 : 26,
            fontWeight: "800",
            color: c.accent,
            textAlign: "center",
            fontVariant: ["tabular-nums"],
          }}
        >
          {to}
        </Text>
      </View>
      <Text style={{ fontSize: 14, color: c.muted, fontWeight: "500" }}>
        {caption}
      </Text>
    </View>
  );
}

/** Sad when the coach eases the plan off, smiling when it steps it up or changes something else. */
export function proposalMood(
  proposal: PlanProposalDetailsProps["proposal"],
  currentTimesPerWeek?: number | null,
): CoachMood {
  const next = proposedPlanSetup(proposal)?.timesPerWeek;
  return next != null && currentTimesPerWeek != null && next < currentTimesPerWeek ? "sad" : "smiling";
}

export function PlanSetupChange({ proposal }: PlanProposalDetailsProps) {
  const plans = usePlans();
  const plan = plans.data?.find((p) => p.id === proposal.planId);
  const setup = proposedPlanSetup(proposal);
  if (!setup || !heroFields.some((field) => setup[field] !== undefined))
    return null;
  const { timesPerWeek, finishingDate, goal } = setup;
  return (
    <View style={{ gap: 16, paddingVertical: 4 }}>
      {timesPerWeek != null && (
        <ChangeHero
          from={plan?.outlineType === "TIMES_PER_WEEK" ? String(plan.timesPerWeek) : undefined}
          to={String(timesPerWeek)}
          caption={timesPerWeek === 1 ? "session a week" : "sessions a week"}
        />
      )}
      {finishingDate !== undefined && (
        <ChangeHero
          size="medium"
          from={plan ? endDate(plan.finishingDate as string | null) : undefined}
          to={endDate(finishingDate)}
          caption="end date"
        />
      )}
      {!!goal && (
        <ChangeHero size="medium" from={plan?.goal} to={goal} caption="goal" />
      )}
    </View>
  );
}
