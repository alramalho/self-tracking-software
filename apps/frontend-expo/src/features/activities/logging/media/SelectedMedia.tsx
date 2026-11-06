import { Image, Pressable, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { AudioLines, Play, X } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import { mediaKindOf } from "@/native/photos";
import { clockDuration } from "./format";
import type { SelectedMediaProps, SelectedMediaTileProps } from "./types";

function VideoThumb({ uri }: { uri: string }) {
  // A paused, muted player renders the first frame as the thumbnail.
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
  });
  return (
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="cover"
      pointerEvents="none"
      style={{ width: "100%", height: "100%", borderRadius: 12 }}
    />
  );
}

function Tile({ item, index, disabled, onRemove }: SelectedMediaTileProps) {
  const c = useColors();
  const kind = mediaKindOf(item);
  const label = kind === "video" ? "video" : kind === "audio" ? "voice note" : "photo";
  return (
    <View style={{ width: "31%", aspectRatio: 1 }}>
      {kind === "image" && (
        <Image
          accessibilityLabel={`Selected photo ${index + 1}`}
          source={{ uri: item.uri }}
          style={{ width: "100%", height: "100%", borderRadius: 12 }}
        />
      )}
      {kind === "video" && <VideoThumb uri={item.uri} />}
      {kind === "audio" && (
        <View
          accessibilityLabel={`Voice note ${index + 1}`}
          style={{
            flex: 1,
            borderRadius: 12,
            backgroundColor: c.soft,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <AudioLines size={28} color={c.accent} />
        </View>
      )}
      {kind !== "image" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 6,
            bottom: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
            backgroundColor: "#000000a0",
          }}
        >
          {kind === "video" && <Play size={10} color="white" fill="white" />}
          <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
            {item.durationMs != null ? clockDuration(item.durationMs) : kind === "video" ? "Video" : "Voice"}
          </Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label} ${index + 1}`}
        disabled={disabled}
        onPress={onRemove}
        hitSlop={8}
        style={{
          position: "absolute",
          right: 2,
          top: 2,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: `${c.bg}e6`,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <X size={16} color={c.text} />
      </Pressable>
    </View>
  );
}

export function SelectedMedia({ media, disabled, onRemove }: SelectedMediaProps) {
  return (
    <View
      testID="selected-activity-photos"
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
    >
      {media.map((item, index) => (
        <Tile
          key={`${item.uri}-${index}`}
          item={item}
          index={index}
          disabled={disabled}
          onRemove={() => onRemove(index)}
        />
      ))}
    </View>
  );
}
