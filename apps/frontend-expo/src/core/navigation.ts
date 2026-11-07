import { router } from "expo-router";
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}

// From a screen stacked above the tabs (Search, Rankings, a circle), a tab profile
// would switch tabs and drop that screen, so Back skipped it. This one stacks on top.
export function openProfile(username: string) {
  router.push({ pathname: "/user/[username]", params: { username } });
}
