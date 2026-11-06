import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pause, Play } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import { clockDuration } from "@/features/activities/logging/media/format";
import type { VoiceNotePlayerProps } from "./types";

const bars = [0.35, 0.6, 0.9, 0.5, 0.75, 1, 0.55, 0.8, 0.4, 0.7, 0.95, 0.5, 0.65, 0.85, 0.45, 0.7, 0.55, 0.9, 0.6, 0.4, 0.75, 0.5, 0.8, 0.35];

// A voice note in a feed card: play/pause, a waveform that fills as it plays, time.
export function VoiceNotePlayer({ uri, title, index }: VoiceNotePlayerProps) {
  const c = useColors();
  const player = useAudioPlayer(uri, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const progress = status.duration ? status.currentTime / status.duration : 0;

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [player, status.didJustFinish]);

  async function toggle() {
    if (status.playing) return player.pause();
    // A voice note is meant to be heard even with the ring switch off.
    await setAudioModeAsync({ playsInSilentMode: true });
    player.play();
  }

  const Icon = status.playing ? Pause : Play;
  return (
    <Pressable
      testID="feed-voice-note"
      accessibilityRole="button"
      accessibilityLabel={`${status.playing ? "Pause" : "Play"} ${title} voice note${index ? ` ${index + 1}` : ""}`}
      onPress={() => void toggle()}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 10,
        paddingRight: 14,
        borderRadius: 999,
        backgroundColor: c.soft,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: c.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color="white" fill="white" />
      </View>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 2, height: 28 }}>
        {bars.map((height, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${height * 100}%`,
              borderRadius: 2,
              backgroundColor: i / bars.length < progress ? c.accent : c.border,
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 12, color: c.muted, fontVariant: ["tabular-nums"], minWidth: 34, textAlign: "right" }}>
        {clockDuration(((status.playing || status.currentTime > 0 ? status.currentTime : status.duration) || 0) * 1000)}
      </Text>
    </Pressable>
  );
}
