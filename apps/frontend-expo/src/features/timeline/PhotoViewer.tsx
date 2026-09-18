import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import type { PhotoViewerProps } from "./types";

export function PhotoViewer({
  uri,
  onClose,
  nativeToolbar = false,
}: PhotoViewerProps) {
  const insets = useSafeAreaInsets();
  const [aspect, setAspect] = useState(1);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useEffect(() => {
    let active = true;
    setAspect(1);
    if (uri)
      Image.getSize(
        uri,
        (w, h) => {
          if (active && h) setAspect(w / h);
        },
        () => {},
      );
    return () => {
      active = false;
    };
  }, [uri]);
  const width = Math.min(viewport.width, viewport.height * aspect);
  const height = width / aspect;
  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.viewport,
          {
            marginTop: nativeToolbar ? 0 : insets.top + 56,
            marginBottom: insets.bottom,
          },
        ]}
        onLayout={({ nativeEvent }) =>
          setViewport({
            width: nativeEvent.layout.width,
            height: nativeEvent.layout.height,
          })
        }
      >
        <ScrollView
          key={uri}
          style={styles.viewport}
          contentContainerStyle={styles.content}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <Pressable
            testID="photo-viewer-backdrop"
            accessibilityLabel="Dismiss photo viewer"
            onPress={onClose}
            style={[styles.backdrop, viewport]}
          >
            {uri && width > 0 && (
              <Pressable
                onPress={(event) => event.stopPropagation()}
                accessible={false}
              >
                <Image
                  source={{ uri }}
                  accessibilityLabel="Expanded activity photo"
                  style={{ width, height }}
                  resizeMode="contain"
                />
              </Pressable>
            )}
          </Pressable>
        </ScrollView>
      </View>
      {!nativeToolbar && (
        <Pressable
          testID="close-photo"
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          hitSlop={8}
          onPress={onClose}
          style={[
            styles.close,
            {
              position: "absolute",
              top: insets.top + 6,
              right: 16,
              zIndex: 10,
            },
          ]}
        >
          <View pointerEvents="none">
            <X size={24} color="white" />
          </View>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "black" },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27272a",
  },
  viewport: { flex: 1 },
  content: { flexGrow: 1 },
  backdrop: { alignItems: "center", justifyContent: "center" },
});
