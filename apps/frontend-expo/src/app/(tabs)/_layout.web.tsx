import { Tabs } from "expo-router";
import {
  Home,
  Target,
  Plus,
  ChartNoAxesCombined,
  UserRound,
} from "lucide-react-native";
import { useColors } from "@/components/ui";
export default function WebTabs() {
  const c = useColors();
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
          ["metrics", "Metrics", ChartNoAxesCombined],
          ["profile", "Profile", UserRound],
        ] as const
      ).map(([name, title, Icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarButtonTestID: `nav-${name === "index" ? "home" : name}`,
            tabBarIcon: ({ color }) => (
              <Icon color={color} size={24} strokeWidth={1.8} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
