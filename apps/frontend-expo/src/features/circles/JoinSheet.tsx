import { useState } from "react";
import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { Button, Copy, Sheet, Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { usePlans, useAction } from "@/data/queries";
import { ReasonChips } from "./components";
import { defaultPreferences, joinByInvite, joinCircle, useMyCircles } from "./api";
import type { JoinSheetProps } from "./types";

// Pick which of your plans joins the circle. Plans already in a circle are shown
// but can't be picked: one circle per plan.
export function JoinSheet({ card, inviteCode, onClose, onJoined }: JoinSheetProps) {
  const c = useColors();
  const plans = usePlans(!!card);
  const mine = useMyCircles(!!card);
  const [picked, setPicked] = useState<string>();
  const taken = new Map((mine.data ?? []).map((circle) => [circle.planId, circle.name]));
  const active = (plans.data ?? []).filter((p) => !p.deletedAt && !p.archivedAt);
  const choice = picked ?? active.find((p) => !taken.has(p.id))?.id;
  const join = useAction(async () => {
    if (!card || !choice) return;
    const joined = inviteCode
      ? await joinByInvite(inviteCode, choice, defaultPreferences)
      : await joinCircle(card.id, choice, defaultPreferences);
    onJoined(joined.id);
  });
  return (
    <Sheet visible={!!card} title={card ? `${card.emoji} ${card.name}` : ""} onClose={onClose}>
      {card && (
        <View style={{ gap: 14 }}>
          <Copy muted>
            {[`${card.memberCount} ${card.memberCount === 1 ? "person" : "people"}`, card.paceLabel, card.place].filter(Boolean).join(" · ")}
          </Copy>
          <ReasonChips reasons={card.reasons} />
          <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>Join with</Text>
          <Status loading={plans.isLoading} error={plans.error} />
          <View style={{ borderRadius: 16, backgroundColor: c.card, overflow: "hidden" }}>
            {active.map((plan, i) => {
              const inCircle = taken.get(plan.id);
              return (
                <Pressable
                  key={plan.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: choice === plan.id, disabled: !!inCircle }}
                  disabled={!!inCircle}
                  onPress={() => setPicked(plan.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 56,
                    paddingHorizontal: 16,
                    borderTopWidth: i ? 1 : 0,
                    borderColor: c.inputBorder,
                    opacity: inCircle ? 0.45 : 1,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{plan.emoji || "✨"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: c.text, fontSize: 16 }}>{plan.goal}</Text>
                    {!!inCircle && <Text style={{ color: c.muted, fontSize: 13 }}>{`Already in ${inCircle}`}</Text>}
                  </View>
                  {choice === plan.id && !inCircle && <Check size={22} color={c.accent} strokeWidth={2.4} />}
                </Pressable>
              );
            })}
          </View>
          <Copy muted>
            You're in once you post a photo from a session. Members see this plan's week and its logs: activity, amount, date, photo and caption. Never your location or private notes.
          </Copy>
          <Status error={join.error} />
          <Button busy={join.isPending} disabled={!choice} onPress={() => join.mutate()}>
            Join circle
          </Button>
        </View>
      )}
    </Sheet>
  );
}
