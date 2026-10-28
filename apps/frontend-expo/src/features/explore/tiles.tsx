import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { PersonAvatar } from "@/features/circles/components";
import { circleLine, planLine } from "./words";
import type { CircleTile, FacesProps, PersonTile, ScrimProps, TileProps } from "./types";

const RADIUS = 18;

// Photo tiles keep white text readable with a dark fade at the bottom.
function Scrim({ id }: ScrimProps) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.72} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function PersonTileView({ tile, onPress }: TileProps<PersonTile>) {
  const c = useColors();
  const { person } = tile;
  const name = person.name || person.username;
  const photo = !!person.picture;
  return (
    <Pressable
      testID={`explore-${tile.key}`}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${planLine(person)}`}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, borderRadius: RADIUS, overflow: "hidden", backgroundColor: c.card, opacity: pressed ? 0.8 : 1 })}
    >
      {photo ? (
        <>
          <Image source={{ uri: person.picture! }} style={{ position: "absolute", inset: 0 }} contentFit="cover" />
          <Scrim id={`scrim-${tile.key}`} />
        </>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 36 }}>
          <PersonAvatar name={name} size={64} />
        </View>
      )}
      <View style={{ position: "absolute", left: 12, right: 12, bottom: 12, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: photo ? "#fff" : c.text, fontSize: 15, fontWeight: "700" }}>{name}</Text>
        <Text numberOfLines={1} style={{ color: photo ? "rgba(255,255,255,0.85)" : c.muted, fontSize: 13 }}>{planLine(person)}</Text>
      </View>
    </Pressable>
  );
}

export function CircleTileView({ tile, size, onPress }: TileProps<CircleTile>) {
  const c = useColors();
  const { card } = tile.circle;
  const photo = card.previews[0];
  const tall = size === "tall";
  const ink = photo ? "#fff" : c.text;
  const quiet = photo ? "rgba(255,255,255,0.85)" : c.muted;
  return (
    <Pressable
      testID={`explore-${tile.key}`}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${circleLine(card)}`}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, borderRadius: RADIUS, overflow: "hidden", backgroundColor: c.card, padding: 14, justifyContent: "space-between", opacity: pressed ? 0.8 : 1 })}
    >
      {photo && (
        <>
          <Image source={{ uri: photo }} style={{ position: "absolute", inset: 0 }} contentFit="cover" blurRadius={tall ? 10 : 8} />
          <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.18)" }} />
          <Scrim id={`scrim-${tile.key}`} />
        </>
      )}
      <Text style={{ fontSize: tall ? 44 : 30 }}>{card.emoji}</Text>
      <View style={{ gap: tall ? 8 : 6 }}>
        <View style={{ gap: 2 }}>
          <Text numberOfLines={2} style={{ color: ink, fontSize: tall ? 18 : 15, fontWeight: "700" }}>{card.name}</Text>
          <Text numberOfLines={1} style={{ color: quiet, fontSize: 13 }}>{circleLine(card)}</Text>
        </View>
        <Faces circle={tile.circle} onPhoto={!!photo} />
      </View>
    </Pressable>
  );
}

function Faces({ circle, onPhoto }: FacesProps) {
  const c = useColors();
  const { card, joined } = circle;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flexDirection: "row" }}>
        {card.members.slice(0, 4).map((member, index) => (
          <View key={index} style={{ marginLeft: index ? -8 : 0, borderRadius: 999, borderWidth: 2, borderColor: onPhoto ? "rgba(255,255,255,0.9)" : c.card }}>
            <PersonAvatar name={member.name} picture={member.picture} size={22} />
          </View>
        ))}
      </View>
      <Text numberOfLines={1} style={{ color: onPhoto ? "rgba(255,255,255,0.85)" : c.muted, fontSize: 12, fontWeight: "600", flexShrink: 1 }}>
        {joined ? "You're in" : `${card.memberCount} of 5`}
      </Text>
    </View>
  );
}
