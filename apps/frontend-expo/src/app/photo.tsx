import { router, Stack, useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { PhotoViewer } from "@/features/timeline/PhotoViewer";

export default function PhotoScreen() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const nativeToolbar = Platform.OS === "ios";
  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/");
  return (
    <>
      <StatusBar style="light" />
      {nativeToolbar && (
        <>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              icon="xmark"
              accessibilityLabel="Close photo"
              onPress={close}
            >
              Close photo
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        </>
      )}
      <PhotoViewer uri={uri} nativeToolbar={nativeToolbar} onClose={close} />
    </>
  );
}
