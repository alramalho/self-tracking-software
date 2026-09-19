import { Image, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { router } from "expo-router";
import {
  differenceInCalendarDays,
  format,
  isToday,
  isYesterday,
} from "date-fns";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { useProfile } from "@/data/queries";
import { profileStats } from "../profile/model";
import type { ActivitySummaryProps, ParticipantAvatarProps } from "./types";
import {
  activityEntryMeasurement,
  appleHealthDuration,
} from "./entry-presentation";

export function ParticipantAvatar({ user, size = 36 }: ParticipantAvatarProps) {
  const c = useColors();
  const profile = useProfile(user?.username ?? undefined);
  const stats = user ? profileStats(profile.data ?? user) : undefined;
  const color = stats?.level[c.dark ? "dark" : "light"] ?? c.muted;
  const radius = (size - 2) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`View ${user?.username ?? "profile"}`}
      hitSlop={6}
      onPress={(event) => {
        event.stopPropagation();
        if (user?.username) router.push(`/profile/${user.username}`);
      }}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: size - 8,
          height: size - 8,
          borderRadius: size,
          backgroundColor: c.soft,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {user?.picture ? (
          <Image
            source={{ uri: user.picture }}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <Text style={{ color: c.text, fontSize: size * 0.38 }}>
            {(user?.name ?? user?.username ?? "U")[0]}
          </Text>
        )}
      </View>
      <Svg
        width={size}
        height={size}
        style={[StyleSheet.absoluteFill, { transform: [{ rotate: "-90deg" }] }]}
        pointerEvents="none"
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeOpacity={0.25}
          strokeWidth={2}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={
            circumference * (1 - (stats?.percentage ?? 0) / 100)
          }
        />
      </Svg>
    </Pressable>
  );
}
function ParticipantName({ user }: ParticipantAvatarProps) {
  const c = useColors();
  const profile = useProfile(user?.username ?? undefined);
  const color = user
    ? profileStats(profile.data ?? user).level[c.dark ? "dark" : "light"]
    : c.muted;
  return (
    <Text
      onPress={() => user?.username && router.push(`/profile/${user.username}`)}
      style={{ color, fontSize: 14 }}
    >
      @{user?.username ?? user?.name ?? "user"}
    </Text>
  );
}
function activityDate(date: number) {
  const d = new Date(date);
  if (isToday(d)) return "today";
  if (isYesterday(d)) return "yesterday";
  if (differenceInCalendarDays(new Date(), d) <= 7)
    return `last ${format(d, "EEEE")}`;
  return format(d, "MMM d");
}
export function ActivitySummary({
  item,
  compact = false,
}: ActivitySummaryProps) {
  const c = useColors();
  const rows = [item, ...(item.sharedEntries ?? [])];
  const joint = rows.length > 1;
  const participants = [
    ...new Map(
      rows.filter((r) => r.user).map((r) => [r.user!.id, r.user!]),
    ).values(),
  ];
  const others = item.entry?.sharedActivityEntry?.sharedActivity.entries.filter(
    (e) =>
      e.activityEntryId !== item.entry?.id &&
      !e.activityEntry?.deletedAt &&
      !participants.some((p) => p.id === e.user.id),
  );
  const avatars =
    joint && participants.length <= 2 ? (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {participants.map((user, index) => (
          <View key={user.id} style={{ marginLeft: index ? -8 : 0 }}>
            <ParticipantAvatar user={user} size={compact ? 24 : 28} />
          </View>
        ))}
      </View>
    ) : joint ? (
      <View style={{ width: compact ? 48 : 58, height: compact ? 48 : 58 }}>
        {participants.slice(0, 6).map((user, index) => {
          const size = compact || participants.length >= 5 ? 24 : 28;
          const center = (compact ? 48 : 58) / 2;
          const angle =
            (index * Math.PI * 2) / Math.min(participants.length, 6) -
            (participants.length === 4 ? (3 * Math.PI) / 4 : Math.PI / 2);
          const offset = center - size / 2 - 1;
          return (
            <View
              key={user.id}
              style={{
                position: "absolute",
                left: center - size / 2 + Math.cos(angle) * offset,
                top: center - size / 2 + Math.sin(angle) * offset,
              }}
            >
              <ParticipantAvatar user={user} size={size} />
            </View>
          );
        })}
        {participants.length > 6 && (
          <Text
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              borderRadius: 10,
              paddingHorizontal: 3,
              backgroundColor: c.soft,
              color: c.text,
              fontSize: 10,
            }}
          >
            +{participants.length - 6}
          </Text>
        )}
      </View>
    ) : (
      <ParticipantAvatar user={item.user} size={compact ? 32 : 36} />
    );
  const names = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      {participants.map((user, index) => (
        <View key={user.id} style={{ flexDirection: "row", gap: 4 }}>
          {index > 0 && <Text style={{ color: c.muted }}>and</Text>}
          <ParticipantName user={user} />
        </View>
      ))}
    </View>
  );
  if (compact)
    return (
      <View style={styles.row}>
        {avatars}
        <Text style={{ fontSize: joint ? 20 : 30 }}>
          {rows
            .slice(0, 3)
            .map((r) => r.activity?.emoji)
            .join("")}
        </Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ color: c.text, fontSize: 12, fontWeight: "600" }}
          >
            {joint
              ? participants.map((p) => `@${p.username}`).join(" and ")
              : item.activity?.title}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            {joint
              ? rows
                  .map(
                    (r) =>
                      `${r.activity?.emoji} ${r.activity?.title} (${activityEntryMeasurement(r.entry, r.activity?.measure)})`,
                  )
                  .join(" and ")
              : activityEntryMeasurement(item.entry, item.activity?.measure)}
          </Text>
          {!!others?.length && (
            <Text style={{ color: c.muted, fontSize: 11 }}>
              with {others.map((e) => `@${e.user.username}`).join(" and ")}
            </Text>
          )}
        </View>
      </View>
    );
  const date = (
    <Text style={{ color: c.muted, fontSize: 12 }}>
      {activityDate(item.date)}
      {appleHealthDuration(item.entry, item.activity?.measure)
        ? ` · ${appleHealthDuration(item.entry, item.activity?.measure)}`
        : ""}
      {item.entry?.timezone ? ` - 📍 ${item.entry.timezone}` : ""}
    </Text>
  );
  if (joint)
    return (
      <View style={{ gap: 8 }}>
        <View style={[styles.row, { gap: 12 }]}>
          {avatars}
          <View style={{ flex: 1 }}>{names}</View>
        </View>
        <Text
          style={{
            alignSelf: "flex-start",
            color: c.muted,
            backgroundColor: c.soft,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: c.border,
            paddingHorizontal: 8,
            paddingVertical: 3,
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 0.5,
          }}
        >
          JOINT ACTIVITY
        </Text>
        {rows.map((row) => (
          <View
            key={row.id}
            testID={`joint-entry-${row.entry?.id}`}
            style={[
              styles.row,
              {
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: c.soft,
              },
            ]}
          >
            <Text style={{ fontSize: 16 }}>{row.activity?.emoji}</Text>
            <Text
              style={{
                flex: 1,
                color: c.text,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              <Text style={{ color: c.muted, fontWeight: "500" }}>
                @{row.user?.username}{" "}
              </Text>
              {row.activity?.title} -{" "}
              {activityEntryMeasurement(row.entry, row.activity?.measure)}
            </Text>
          </View>
        ))}
        {date}
      </View>
    );
  return (
    <View style={styles.row}>
      {avatars}
      <Text style={{ fontSize: 48 }}>{item.activity?.emoji}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <ParticipantName user={item.user} />
        <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
          {item.activity?.title} -{" "}
          {activityEntryMeasurement(item.entry, item.activity?.measure)}
        </Text>
        {!!others?.length && (
          <Text style={{ color: c.muted, fontSize: 12 }}>
            with {others.map((e) => `@${e.user.username}`).join(" and ")}
          </Text>
        )}
        {date}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
