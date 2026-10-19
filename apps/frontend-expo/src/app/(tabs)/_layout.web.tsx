import { Tabs } from "expo-router";
import {
  Home,
  Target,
  Plus,
  UserRound,
} from "lucide-react-native";
import { Image } from "react-native";
import { useColors } from "@/components/ui";
import { useCurrentUser } from "@/data/queries";
import { coachTabIcon } from "@/features/coach/avatar";
export default function WebTabs() {
  const c = useColors();
  const strategist = useCurrentUser().data?.coachPersonality === "STRATEGIST";
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
      }}
    >
      {(
        [
          ["index", "Home", Home],
          ["plans", "Plans", Target],
          ["add", "Add", Plus],
          ["coach", "Coach", null],
          ["profile", "Profile", UserRound],
        ] as const
      ).map(([name, title, Icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarButtonTestID: `nav-${name === "index" ? "home" : name}`,
            tabBarIcon: ({ color, focused }) =>
              Icon ? (
                <Icon color={color} size={24} strokeWidth={1.8} />
              ) : (
                // The coach's own face, as on iPhone.
                <Image
                  source={coachTabIcon(strategist)}
                  style={{ width: 26, height: 26, opacity: focused ? 1 : 0.7 }}
                />
              ),
          }}
        />
      ))}
    </Tabs>
  );
}
