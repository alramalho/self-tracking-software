import { Text } from "@/components/typography/Text";
import { Button, Copy, Sheet, useColors } from "@/components/ui";
import type { PlanLimitSheetProps } from "./types";

export function PlanLimitSheet({ visible, planType, onClose }: PlanLimitSheetProps) {
  const c = useColors();
  const plan = planType || "FREE";
  return (
    <Sheet visible={visible} title="Create New Plan" onClose={onClose}>
      <Text
        style={{
          fontFamily: "Caveat",
          fontSize: 30,
          color: plan === "FREE" ? c.muted : c.accent,
        }}
      >
        {`On ${plan.charAt(0)}${plan.slice(1).toLowerCase()} Plan`}
      </Text>
      <Copy>You have reached the maximum number of plans for your account.</Copy>
      <Copy muted>
        Delete a plan you no longer follow to make room for a new one.
      </Copy>
      <Button onPress={onClose}>Got it</Button>
    </Sheet>
  );
}
