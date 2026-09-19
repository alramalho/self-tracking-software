import { Image } from "react-native";
import { SymbolView } from "expo-symbols";
import { useColors } from "@/components/ui";

export type IntegrationIconProps = {
  size?: number;
  color?: string;
  accessibilityLabel?: string;
};

export function AppleLogoIcon({
  size = 30,
  accessibilityLabel = "Apple logo",
}: IntegrationIconProps) {
  const c = useColors();
  return (
    <SymbolView
      accessibilityLabel={accessibilityLabel}
      name="apple.logo"
      size={size}
      tintColor={c.text}
      type="monochrome"
    />
  );
}

export function GarminLogoIcon({
  size = 30,
  accessibilityLabel = "Garmin logo",
}: IntegrationIconProps) {
  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      source={require("../../../assets/integrations/garmin-mark.png")}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}

export function HealthProviderIcon({
  provider,
  size = 20,
  accessibilityLabel,
}: {
  provider?: string | null;
  size?: number;
  accessibilityLabel?: string;
}) {
  if (provider?.startsWith("garmin")) {
    return (
      <GarminLogoIcon
        size={size}
        accessibilityLabel={accessibilityLabel ?? "Garmin Connect icon"}
      />
    );
  }
  if (provider?.startsWith("apple")) {
    return (
      <AppleLogoIcon
        size={size}
        accessibilityLabel={accessibilityLabel ?? "Apple Health icon"}
      />
    );
  }
  return null;
}

export function healthProviderLabel(provider?: string | null): string | null {
  if (provider?.startsWith("garmin")) return "Garmin Connect";
  if (provider?.startsWith("apple")) return "Apple Health";
  return null;
}
