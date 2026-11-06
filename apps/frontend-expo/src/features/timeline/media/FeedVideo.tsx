import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { Play, Volume2, VolumeX } from "lucide-react-native";
import { useFeedAutoplay } from "./autoplay";
import type { FeedVideoProps } from "./types";

// In the home feed the visible video loops muted; a tap toggles sound.
// Elsewhere (profiles, circles) it waits for a tap and then plays with sound.
export function FeedVideo({ uri, cardId, title }: FeedVideoProps) {
  const autoplay = useFeedAutoplay();
  const [localMuted, setLocalMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const muted = autoplay ? autoplay.muted : localMuted;
  const shouldPlay = autoplay ? autoplay.playingCardId === cardId : started;
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    // 'auto' lets the person's music keep playing while the video is muted.
    p.audioMixingMode = "auto";
  });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);
  useEffect(() => {
    if (shouldPlay) player.play();
    else player.pause();
  }, [player, shouldPlay]);

  function onPress() {
    if (!shouldPlay) {
      setStarted(true);
      return;
    }
    if (autoplay) autoplay.setMuted(!muted);
    else setLocalMuted(!localMuted);
  }

  const Sound = muted ? VolumeX : Volume2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        !shouldPlay ? `Play ${title} video` : muted ? `Unmute ${title} video` : `Mute ${title} video`
      }
      onPress={onPress}
      style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
    >
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="cover"
        pointerEvents="none"
        style={{ width: "100%", height: "100%" }}
      />
      {!isPlaying && !shouldPlay && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#00000080",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={24} color="white" fill="white" />
          </View>
        </View>
      )}
      {shouldPlay && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 10,
            bottom: 10,
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: "#00000099",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sound size={16} color="white" />
        </View>
      )}
    </Pressable>
  );
}
