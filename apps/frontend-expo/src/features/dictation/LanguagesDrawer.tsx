import { Pressable, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Copy, Status, useColors } from "@/components/ui";
import type { User } from "@/core/types";
import { useCurrentUser } from "@/data/queries";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { spokenLanguages, toggleLanguage } from "./languages";
import { saveSpokenLanguages } from "./service";
import type { LanguagesDrawerProps } from "./types";

// "Pick your languages": speech to text listens for these. Each tap saves.
export function LanguagesDrawer({ onClose }: LanguagesDrawerProps) {
  const c = useColors();
  const client = useQueryClient();
  const user = useCurrentUser();
  const chosen = user.data?.spokenLanguages ?? [];
  const save = useMutation({
    mutationFn: saveSpokenLanguages,
    // Quick taps save one after the other, so the last tap is what's stored.
    scope: { id: "spoken-languages" },
    // Show the choice straight away; put the saved list back if it fails.
    onMutate: (next) => {
      client.setQueryData<User>(
        ["current-user"],
        (current) => current && { ...current, spokenLanguages: next },
      );
      return chosen;
    },
    onError: (_error, _next, previous) =>
      client.setQueryData<User>(
        ["current-user"],
        (current) => current && { ...current, spokenLanguages: previous },
      ),
  });
  return (
    <LoggingDrawer
      testID="languages-drawer"
      dismissLabel="Dismiss languages"
      title="Which languages do you speak?"
      onClose={onClose}
    >
      <Copy muted>
        We’ll listen for these when you dictate. The first one you pick is your
        main language.
      </Copy>
      <Status error={save.error} />
      <View style={{ borderRadius: 20, overflow: "hidden", backgroundColor: c.card }}>
        {spokenLanguages.map((language, index) => {
          const selected = chosen.includes(language.code);
          return (
            <Pressable
              key={language.code}
              accessibilityRole="button"
              accessibilityLabel={language.name}
              accessibilityState={{ selected }}
              onPress={() => save.mutate(toggleLanguage(chosen, language.code))}
              style={({ pressed }) => ({
                minHeight: 52,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 16,
                borderTopWidth: index ? 1 : 0,
                borderColor: c.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>
                {language.name}
                {language.native !== language.name && (
                  <Text style={{ color: c.muted }}> · {language.native}</Text>
                )}
              </Text>
              {chosen[0] === language.code && chosen.length > 1 && (
                <Text style={{ color: c.muted, fontSize: 13 }}>Main</Text>
              )}
              {selected && <Check size={20} color={c.accent} />}
            </Pressable>
          );
        })}
      </View>
    </LoggingDrawer>
  );
}
