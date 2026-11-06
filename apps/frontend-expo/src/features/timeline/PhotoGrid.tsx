import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import { mediaKind } from "@tsw/prisma/media";
import { FeedVideo } from "./media/FeedVideo";
import type { PhotoGridProps } from "./types";

// Photos and videos of one card. A lone video gets Instagram's 4:5 frame.
export function PhotoGrid({ photos, title, cardId }: PhotoGridProps) {
  const [width, setWidth] = useState(0);
  const [aspect, setAspect] = useState(1);
  const singleUri =
    photos.length === 1 && mediaKind(photos[0]) === "image" ? photos[0] : undefined;
  const singleVideo = photos.length === 1 && !singleUri;
  useEffect(() => {
    let active = true;
    setAspect(1);
    if (singleUri)
      Image.getSize(
        singleUri,
        (w, h) => {
          if (active && w && h) setAspect(w / h);
        },
        () => {},
      );
    return () => {
      active = false;
    };
  }, [singleUri]);
  return (
    <>
      <View
        onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 4,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {photos.map((uri, index) => {
          const cell = {
            width:
              photos.length === 1 || (photos.length === 3 && index === 0)
                ? "100%"
                : width
                  ? (width - 4) / 2
                  : "49%",
            ...(singleVideo
              ? { aspectRatio: 4 / 5, maxHeight: 480 }
              : photos.length === 1 && width
                ? { height: Math.min(400, width / aspect) }
                : {
                    aspectRatio: photos.length === 3 && index === 0 ? 1.5 : 1,
                  }),
          } as const;
          return mediaKind(uri) === "video" ? (
            <View key={uri} testID="feed-video" style={cell}>
              <FeedVideo uri={uri} cardId={cardId} title={title} />
            </View>
          ) : (
          <Pressable
            key={uri}
            accessibilityRole="button"
            accessibilityLabel={`Open ${title} photo ${index + 1}`}
            onPress={() =>
              router.push({ pathname: "/photo", params: { uri, title } })
            }
            style={cell}
          >
            <Image
              source={{ uri }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </Pressable>
          );
        })}
      </View>
    </>
  );
}
