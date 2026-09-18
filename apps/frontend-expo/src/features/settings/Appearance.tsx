import { Pressable, View } from "react-native";
import { Check, Monitor, Moon, Sun } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { AppearanceProps } from "./types";

const palettes = [
  { name: "Blue", colors: ["#3b82f6", "#60a5fa", "#93c5fd"] },
  { name: "Slate", colors: ["#64748b", "#94a3b8", "#cbd5e1"] },
  { name: "Violet", colors: ["#8b5cf6", "#a78bfa", "#c4b5fd"] },
  { name: "Emerald", colors: ["#10b981", "#34d399", "#6ee7b7"] },
  { name: "Rose", colors: ["#f43f5e", "#fb7185", "#fda4af"] },
  { name: "Amber", colors: ["#f59e0b", "#fbbf24", "#fcd34d"] },
  { name: "Random", colors: [] },
];
export function ColorPalettes({ selected, busy, onSelect }: AppearanceProps) {
  const c = useColors();
  return (
    <View testID="settings-palettes" style={{ gap: 16 }}>
      {palettes.map(({ name, colors }) => {
        const active = selected === name.toUpperCase();
        return (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={name}
            accessibilityState={{ selected: active, disabled: busy }}
            disabled={busy}
            onPress={() => onSelect(name.toUpperCase())}
            style={({ pressed }) => ({
              borderRadius: 8,
              borderWidth: active ? 2 : 1,
              borderColor: active ? colors[0] || c.accent : c.inputBorder,
              backgroundColor: c.dark ? "#0000001a" : "#ffffff66",
              minHeight: 50,
              padding: active ? 11 : 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              opacity: busy ? 0.6 : pressed ? 0.65 : 1,
            })}
          >
            {active && <Check size={16} color={colors[0] || c.accent} />}
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: "500" }}>
                {name}
              </Text>
              {name === "Random" && (
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                  Changes every 3 days
                </Text>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {colors.map((color) => (
                <View
                  key={color}
                  testID={`palette-swatch-${name}-${color}`}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: color,
                  }}
                />
              ))}
              {!colors.length && <Text style={{ fontSize: 24 }}>🎲</Text>}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
export function ThemeModes({ selected, busy, onSelect }: AppearanceProps) {
  const c = useColors();
  return (
    <View style={{ gap: 12 }}>
      {[
        {
          name: "Light",
          mode: "LIGHT",
          description: "Always use light theme",
          icon: Sun,
        },
        {
          name: "Dark",
          mode: "DARK",
          description: "Always use dark theme",
          icon: Moon,
        },
        {
          name: "Auto",
          mode: "AUTO",
          description: "Match system preference",
          icon: Monitor,
        },
      ].map(({ name, mode, description, icon: Icon }) => (
        <Pressable
          key={mode}
          accessibilityRole="button"
          accessibilityLabel={name}
          accessibilityState={{ selected: selected === mode, disabled: busy }}
          disabled={busy}
          onPress={() => onSelect(mode)}
          style={({ pressed }) => ({
            borderRadius: 8,
            borderWidth: selected === mode ? 2 : 1,
            borderColor: selected === mode ? c.accent : c.inputBorder,
            padding: selected === mode ? 11 : 12,
            minHeight: 64,
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
            opacity: busy ? 0.6 : pressed ? 0.65 : 1,
          })}
        >
          <Icon size={20} color={c.muted} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: "500" }}>
              {name}
            </Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>{description}</Text>
          </View>
          {selected === mode && <Check size={20} color={c.accent} />}
        </Pressable>
      ))}
    </View>
  );
}
