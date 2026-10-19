import { useColors } from "@/components/ui";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useCurrentUser } from "@/data/queries";
import { coachTabIcon } from "@/features/coach/avatar";
import { useCoachInbox } from "@/features/coach/inbox/useCoachInbox";
export default function TabsLayout() {
  const colors = useColors();
  const strategist = useCurrentUser().data?.coachPersonality === "STRATEGIST";
  const pending = useCoachInbox().pendingCount;
  return (
    <NativeTabs
      tabBarRespectsIMEInsets
      minimizeBehavior="onScrollDown"
      tintColor={colors.accent}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md="home"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plans">
        <NativeTabs.Trigger.Icon sf="target" md="flag" />
        <NativeTabs.Trigger.Label>Plans</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Icon sf="plus.circle.fill" md="add_circle" />
        <NativeTabs.Trigger.Label>Add</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="coach">
        {/* The coach's own face, not a symbol: the tab is where the coach steps in. */}
        <NativeTabs.Trigger.Icon src={coachTabIcon(strategist)} renderingMode="original" />
        <NativeTabs.Trigger.Label>Coach</NativeTabs.Trigger.Label>
        {pending > 0 && <NativeTabs.Trigger.Badge>{String(pending)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
          md="account_circle"
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
