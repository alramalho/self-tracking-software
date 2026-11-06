import { View } from "react-native";
import { Monitor, Moon, Sun } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
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
const modes = [
  { name: "Light", mode: "LIGHT", icon: Sun },
  { name: "Dark", mode: "DARK", icon: Moon },
  { name: "Auto", mode: "AUTO", icon: Monitor },
];
const capitalize = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase();

/** "Dark · Amber": the summary shown on the Appearance row. */
export function appearanceSummary(mode?: string, palette?: string) {
  return [mode, palette].filter(Boolean).map((v) => capitalize(v!)).join(" · ");
}

export function ThemeModes({ selected, busy, onSelect }: AppearanceProps) {
  return (
    <SettingsGroup title="Mode" footer="Auto matches your device's setting.">
      {modes.map(({ name, mode, icon }) => (
        <SettingsRow
          key={mode}
          icon={icon}
          title={name}
          selected={selected === mode}
          disabled={busy}
          onPress={() => onSelect(mode)}
        />
      ))}
    </SettingsGroup>
  );
}

export function ColorPalettes({ selected, busy, onSelect }: AppearanceProps) {
  return (
    <SettingsGroup
      testID="settings-palettes"
      title="Color"
      footer="Random changes every 3 days."
      separatorInset={0}
    >
      {palettes.map(({ name, colors }) => (
        <SettingsRow
          key={name}
          title={name}
          selected={selected === name.toUpperCase()}
          disabled={busy}
          onPress={() => onSelect(name.toUpperCase())}
          trailing={
            <View style={{ flexDirection: "row", gap: 6 }}>
              {colors.map((color) => (
                <View
                  key={color}
                  testID={`palette-swatch-${name}-${color}`}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: color,
                  }}
                />
              ))}
              {!colors.length && <Text style={{ fontSize: 18 }}>🎲</Text>}
            </View>
          }
        />
      ))}
    </SettingsGroup>
  );
}
