import { Image, Platform, Pressable, View } from "react-native";
import { Check, Plus } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Status, useColors } from "@/components/ui";
import { useAction } from "@/data/queries";
import { useSession } from "@/auth/provider";
import { SettingsRow } from "./SettingsRow";

/** Every account remembered on this device; tap one to switch to it. */
export function Accounts() {
  const auth = useSession(),
    c = useColors();
  const switchTo = useAction((userId: string) => auth.switchAccount(userId));
  const add = useAction<void>(() => auth.addAccount());
  const busy = switchTo.isPending || add.isPending;
  return (
    <View style={{ gap: 4 }}>
      {auth.accounts.map((account) => {
        const active = account.userId === auth.userId;
        return (
          <Pressable
            key={account.userId}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${account.name}`}
            accessibilityState={{ selected: active }}
            disabled={busy}
            onPress={() => switchTo.mutate(account.userId)}
            style={({ pressed }) => ({
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              opacity: pressed ? 0.55 : 1,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                overflow: "hidden",
                backgroundColor: c.soft,
              }}
            >
              {account.imageUrl && (
                <Image
                  source={{ uri: account.imageUrl }}
                  style={{ width: 40, height: 40 }}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: c.text }} numberOfLines={1}>
                {account.name}
              </Text>
              {account.email && (
                <Text
                  style={{ fontSize: 13, color: c.muted }}
                  numberOfLines={1}
                >
                  {account.email}
                </Text>
              )}
            </View>
            {active && <Check size={20} color={c.accent} />}
          </Pressable>
        );
      })}
      {/* Web has no secure place to remember a second account. */}
      {Platform.OS !== "web" && (
        <SettingsRow
          icon={Plus}
          title="Add account"
          onPress={() => !busy && add.mutate()}
        />
      )}
      <Status error={switchTo.error ?? add.error} />
    </View>
  );
}
