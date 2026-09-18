import { router } from "expo-router";
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}
