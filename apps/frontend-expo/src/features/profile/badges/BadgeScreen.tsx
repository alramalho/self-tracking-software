import { Platform, Pressable, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useCurrentUser, usePlans, useProfile } from "@/data/queries";
import { Status } from "@/components/ui";
import { goBack } from "@/core/navigation";
import { BadgeDetails } from "./BadgeDetails";
import type { BadgeKind } from "./types";
export default function BadgeScreen() {
  const params = useLocalSearchParams<{ kind?: string; userId?: string }>();
  const current = useCurrentUser();
  const own = !params.userId || params.userId === current.data?.id;
  const plans = usePlans(own);
  const profile = useProfile(
    undefined,
    !own && current.data ? params.userId : undefined,
  );
  const user =
    own && current.data
      ? { ...current.data, plans: plans.data ?? [] }
      : profile.data;
  const kind: BadgeKind =
    params.kind === "habits" || params.kind === "lifestyles"
      ? params.kind
      : "streaks";
  const error = current.error ?? (own ? plans.error : profile.error);
  const content =
    user && !error ? (
      <BadgeDetails user={user} kind={kind} onClose={goBack} />
    ) : (
      <Status
        loading={!error}
        error={error}
        retry={() => {
          void current.refetch();
          void (own ? plans.refetch() : profile.refetch());
        }}
      />
    );
  return Platform.OS === "web" ? (
    <View
      style={{
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "#00000059",
      }}
    >
      <Pressable
        style={{ position: "absolute", inset: 0 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss badge details"
        onPress={goBack}
      />
      <View
        style={{
          height: "72%",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          overflow: "hidden",
        }}
      >
        {content}
      </View>
    </View>
  ) : (
    <View style={{ flex: 1 }}>{content}</View>
  );
}
