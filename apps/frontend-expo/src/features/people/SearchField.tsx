import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { Search, X } from "lucide-react-native";
import { IconButton, useColors } from "@/components/ui";
import type { SearchFieldProps } from "./types";

// Waits for typing to pause before searching.
export function useDebounced(value: string, delay = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return [settled, setSettled] as const;
}

export function SearchField({ testID, label, placeholder, value, onChange, onSubmit }: SearchFieldProps) {
  const c = useColors();
  return (
    <View style={{ marginHorizontal: 24, marginBottom: 20, paddingLeft: 14, minHeight: 50, borderRadius: 16, backgroundColor: c.soft, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Search size={20} color={c.muted} />
      <TextInput
        testID={testID} accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={c.muted}
        value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} maxLength={80} returnKeyType="search"
        onSubmitEditing={onSubmit}
        style={{ flex: 1, color: c.text, fontSize: 16, fontFamily: "Inter-Regular", paddingVertical: 14 }}
      />
      {!!value && <IconButton label="Clear search" icon={X} onPress={() => onChange("")} />}
    </View>
  );
}
