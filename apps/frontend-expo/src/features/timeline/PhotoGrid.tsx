import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import type { PhotoGridProps } from "./types";
export function PhotoGrid({ photos, title }: PhotoGridProps) {
  const [width, setWidth] = useState(0);
  const [aspect, setAspect] = useState(1);
  const singleUri = photos.length === 1 ? photos[0] : undefined;
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
        {photos.map((uri, index) => (
          <Pressable
            key={uri}
            accessibilityRole="button"
            accessibilityLabel={`Open ${title} photo ${index + 1}`}
            onPress={() =>
              router.push({ pathname: "/photo", params: { uri, title } })
            }
            style={{
              width:
                photos.length === 1 || (photos.length === 3 && index === 0)
                  ? "100%"
                  : width
                    ? (width - 4) / 2
                    : "49%",
              ...(photos.length === 1 && width
                ? { height: Math.min(400, width / aspect) }
                : {
                    aspectRatio: photos.length === 3 && index === 0 ? 1.5 : 1,
                  }),
            }}
          >
            <Image
              source={{ uri }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </View>
    </>
  );
}
