import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Cake, ChevronRight, Gauge, Hand, Lock, MapPin, Target, Check } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { MATCHING_TARGET } from "./model";
import type {
  CircleCardViewProps,
  MatchPreferencesListProps,
  MatchReason,
  MemberRowProps,
  OpenSpotsProps,
  PersonAvatarProps,
  ReasonChipsProps,
  WeekDotsProps,
} from "./types";

const palette = ["#e0527d", "#d97706", "#8b5cf6", "#0f9f6e", "#3b82f6", "#64748b", "#db2777", "#0891b2"];

// A stable colour per person for avatars without a photo.
export function avatarColor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

export function firstName(person: { name?: string | null; username?: string | null }) {
  return person.name?.split(" ")[0] || person.username || "Someone";
}

export function PersonAvatar({ name, picture, size = 32, ring }: PersonAvatarProps) {
  const c = useColors();
  const ringColor = ring === "on" ? "#22c55e" : ring === "accent" ? c.accent : ring === "off" ? c.soft : undefined;
  return (
    <View
      style={{
        width: size + (ringColor ? 6 : 0),
        height: size + (ringColor ? 6 : 0),
        borderRadius: 999,
        borderWidth: ringColor ? 2 : 0,
        borderColor: ringColor,
        padding: ringColor ? 1 : 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: avatarColor(name ?? "?"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {picture ? (
          <Image source={{ uri: picture }} style={{ width: size, height: size }} contentFit="cover" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.42 }}>
            {(name ?? "?").slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
    </View>
  );
}

// One dot per planned session this week, green once done.
export function WeekDots({ target, done }: WeekDotsProps) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {Array.from({ length: Math.max(target, 1) }, (_, i) => (
        <View
          key={i}
          style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: i < done ? "#22c55e" : c.soft }}
        />
      ))}
    </View>
  );
}

// Board row: who, their goal, this week's dots, and a nudge for anyone behind.
// "N to go" in orange is the only signal that someone is behind.
export function MemberRow({ member, isMe, onPress, onNudge }: MemberRowProps) {
  const c = useColors();
  const { week } = member;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${isMe ? "You" : firstName(member.user)}, ${week.isNew ? "new this week" : `${week.done} of ${week.target} this week`}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <PersonAvatar name={member.user.name ?? member.user.username ?? null} picture={member.user.picture} size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>{isMe ? "You" : firstName(member.user)}</Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12 }}>
          {member.plan.emoji ? `${member.plan.emoji} ` : ""}
          {member.plan.goal}
        </Text>
      </View>
      {member.pending || week.isNew ? (
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.soft }}>
          <Text style={{ color: c.text, fontSize: 11, fontWeight: "600" }}>{member.pending ? "Pending" : "New"}</Text>
        </View>
      ) : (
        <WeekDots target={week.target} done={week.done} />
      )}
      <Text
        style={{
          width: 52,
          textAlign: "right",
          fontSize: 13,
          fontVariant: ["tabular-nums"],
          color: week.behind ? "#fb923c" : c.muted,
          fontWeight: week.behind ? "600" : "400",
        }}
      >
        {member.pending || week.isNew ? "" : week.behind ? `${week.toGo} to go` : `${week.done}/${week.target}`}
      </Text>
      <View style={{ width: 34, alignItems: "flex-end" }}>
        {onNudge && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Nudge ${firstName(member.user)}`}
            onPress={onNudge}
            hitSlop={8}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.soft, alignItems: "center", justifyContent: "center" }}
          >
            <Hand size={16} color={c.text} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// Dashed spots for the people matching will still bring in. The circle keeps looking
// until it has 5, even after its board has started.
export function OpenSpots({ members }: OpenSpotsProps) {
  const c = useColors();
  const open = Math.max(0, MATCHING_TARGET - members);
  if (!open) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: c.muted, fontSize: 12, paddingTop: 8 }}>Looking for people with a similar goal</Text>
      {Array.from({ length: open }, (_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.muted }} />
          <Text style={{ color: c.muted, fontSize: 15 }}>Open spot</Text>
        </View>
      ))}
    </View>
  );
}

const reasonLabels: Record<MatchReason, string> = {
  goal: "Similar goal",
  pace: "Similar pace",
  sameCity: "Same city",
  timezone: "Same time zone",
  age: "Similar age",
};

export function ReasonChips({ reasons }: ReasonChipsProps) {
  const c = useColors();
  if (!reasons.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {reasons.map((reason) => (
        <View key={reason} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: c.selectedBg }}>
          <Text style={{ color: c.accent, fontSize: 12, fontWeight: "600" }}>{reasonLabels[reason]}</Text>
        </View>
      ))}
    </View>
  );
}

// Search result: what the circle is, and blurred squares of its latest photos so
// you can see people really post. Only blurred previews ever reach non-members.
export function CircleCardView({ card, onPress }: CircleCardViewProps) {
  const c = useColors();
  const meta = [`${card.memberCount} of 5`, card.place, card.logsThisWeek ? `${card.logsThisWeek} logs this week` : card.paceLabel]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${meta}`}
      onPress={onPress}
      style={({ pressed }) => ({ borderRadius: 20, backgroundColor: c.card, padding: 14, gap: 10, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.soft, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 22 }}>{card.emoji}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{card.name}</Text>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>{meta}</Text>
        </View>
        <ChevronRight size={18} color={c.muted} />
      </View>
      {card.previews.length > 0 && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          {card.previews.map((uri, i) => (
            <View key={i} style={{ flex: 1, height: 58, borderRadius: 12, overflow: "hidden", backgroundColor: c.soft }}>
              <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" blurRadius={6} />
              {i === card.previews.length - 1 && card.morePhotos > 0 && (
                <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>+{card.morePhotos}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
      <ReasonChips reasons={card.reasons} />
    </Pressable>
  );
}

// "Match me by": goal always counts, the rest are the person's choice.
export function MatchPreferencesList({ value, onChange, place, age, weeklyTarget }: MatchPreferencesListProps) {
  const c = useColors();
  const rows = [
    { key: "goal", icon: Target, title: "Goal", detail: null, on: true, locked: true },
    { key: "wantsPace", icon: Gauge, title: "Pace", detail: `${weeklyTarget} a week`, on: value.wantsPace },
    { key: "wantsNearby", icon: MapPin, title: "Nearby", detail: place, on: value.wantsNearby },
    { key: "wantsAge", icon: Cake, title: "Age", detail: age ? String(age) : null, on: value.wantsAge },
  ] as const;
  return (
    <View style={{ borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.inputBorder, overflow: "hidden" }}>
      {rows.map((row, i) => (
        <Pressable
          key={row.key}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: row.on, disabled: "locked" in row }}
          accessibilityLabel={row.title}
          disabled={"locked" in row}
          onPress={() => {
            if (row.key !== "goal") onChange({ ...value, [row.key]: !value[row.key] });
          }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            minHeight: 56,
            paddingHorizontal: 16,
            borderTopWidth: i ? 1 : 0,
            borderColor: c.inputBorder,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <row.icon size={22} color={c.text} strokeWidth={1.8} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 17 }}>{row.title}</Text>
            {!!row.detail && <Text style={{ color: c.muted, fontSize: 13 }}>{row.detail}</Text>}
          </View>
          {"locked" in row ? (
            <Lock size={18} color={c.muted} />
          ) : (
            row.on && <Check size={22} color={c.accent} strokeWidth={2.4} />
          )}
        </Pressable>
      ))}
    </View>
  );
}
