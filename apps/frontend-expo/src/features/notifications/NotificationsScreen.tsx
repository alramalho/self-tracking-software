import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, ChevronRight } from "lucide-react-native";
import { IconButton, Screen, Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { api } from "@/data/api";
import { useCurrentUser } from "@/data/queries";
import { goBack } from "@/core/navigation";
import { SettingsGroup } from "@/features/settings/SettingsGroup";
import { coachIdentity } from "@/features/messages/coach";
import type { AppNotification } from "@/features/social/types";
import { notificationRoute } from "@/native/notification-routing";
import { notificationTarget } from "@/native/notification-target";
import {
  isUnread,
  notificationActor,
  notificationText,
  shownNotifications,
  splitSections,
  timeAgo,
} from "./model";
import type { NotificationAvatarProps, NotificationRowProps } from "./types";

const AVATAR = 44;

export function NotificationsScreen() {
  const c = useColors();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await api.get<AppNotification[]>("/notifications")).data,
  });
  // Opening the list counts as seeing it. What was unread stays under New for this visit.
  const [freshIds, setFreshIds] = useState<Set<string> | null>(null);
  const markSeen = useMutation({
    mutationFn: async (ids: string[]) =>
      api.post("/notifications/mark-notifications-opened", {
        notification_ids: ids,
      }),
  });
  useEffect(() => {
    if (!query.data || freshIds) return;
    const unread = query.data.filter(isUnread).map((n) => n.id);
    setFreshIds(new Set(unread));
    if (unread.length) markSeen.mutate(unread);
  }, [query.data, freshIds, markSeen.mutate]);

  const shown = shownNotifications(query.data ?? []);
  const { fresh, earlier } = splitSections(shown, freshIds ?? new Set());
  return (
    <Screen
      title="Notifications"
      leading={<IconButton label="Back" icon={ArrowLeft} onPress={goBack} />}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <Status
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.isSuccess && shown.length === 0 && (
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 64 }}>
          <Bell size={40} color={c.muted} strokeWidth={1.5} />
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
            You're all caught up
          </Text>
          <Text style={{ color: c.muted, textAlign: "center" }}>
            Reactions, comments and photos from friends show up here.
          </Text>
        </View>
      )}
      <SettingsGroup title={fresh.length ? "New" : undefined} separatorInset={AVATAR + 12}>
        {fresh.map((n) => (
          <NotificationRow key={n.id} notification={n} />
        ))}
      </SettingsGroup>
      <SettingsGroup title={fresh.length ? "Earlier" : undefined} separatorInset={AVATAR + 12}>
        {earlier.map((n) => (
          <NotificationRow key={n.id} notification={n} />
        ))}
      </SettingsGroup>
    </Screen>
  );
}

function NotificationRow({ notification }: NotificationRowProps) {
  const c = useColors();
  const target = notificationRoute(notificationTarget(notification));
  const { handle, rest, emoji } = notificationText(notification);
  const when = timeAgo(notification.createdAt);
  return (
    <Pressable
      accessibilityRole={target ? "button" : undefined}
      accessibilityLabel={[handle, rest, emoji, when].filter(Boolean).join(" ")}
      disabled={!target}
      onPress={() => target && router.push(target as never)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <NotificationAvatar notification={notification} emoji={emoji} />
      <Text
        numberOfLines={3}
        style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 20 }}
      >
        {!!handle && <Text style={{ fontWeight: "700" }}>{handle}</Text>}
        {rest}
        {!!when && <Text style={{ color: c.muted }}>{`  ${when}`}</Text>}
      </Text>
      {target && <ChevronRight size={18} color={c.muted} />}
    </Pressable>
  );
}

function NotificationAvatar({
  notification,
  emoji,
}: NotificationAvatarProps) {
  const c = useColors();
  const user = useCurrentUser();
  const actor = notificationActor(notification);
  const circle = {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: c.soft,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
  };
  return (
    <View style={{ width: AVATAR, height: AVATAR }}>
      {notification.type === "COACH" ? (
        <Image
          source={coachIdentity(user.data?.coachPersonality).avatar}
          resizeMode="contain"
          style={{ width: AVATAR, height: AVATAR }}
        />
      ) : actor?.picture ? (
        <Image source={{ uri: actor.picture }} style={circle} />
      ) : (
        <View style={circle}>
          {actor?.name ? (
            <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
              {actor.name.slice(0, 1).toUpperCase()}
            </Text>
          ) : (
            <Bell size={20} color={c.muted} strokeWidth={1.8} />
          )}
        </View>
      )}
      {!!emoji && (
        <View
          style={{
            position: "absolute",
            right: -6,
            bottom: -4,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: c.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 14, lineHeight: 18 }}>{emoji}</Text>
        </View>
      )}
    </View>
  );
}
