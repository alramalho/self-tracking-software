import { useRef } from "react";
import { Alert, Platform } from "react-native";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";

const TITLE = "Discard changes?";
const MESSAGE = "You'll lose the changes you made to this plan.";

function confirmDiscard(onDiscard: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${TITLE}\n\n${MESSAGE}`)) onDiscard();
    return;
  }
  Alert.alert(TITLE, MESSAGE, [
    { text: "Keep editing", style: "cancel" },
    { text: "Discard", style: "destructive", onPress: onDiscard },
  ]);
}

/**
 * Leaving the screen with unsaved changes (back, close, swipe) asks first.
 * Call `allowLeave()` right before navigating away after a successful save.
 */
export function useUnsavedChangesGuard(hasChanges: boolean) {
  const navigation = useNavigation();
  const leaving = useRef(false);
  usePreventRemove(hasChanges, ({ data }) => {
    if (leaving.current) navigation.dispatch(data.action);
    else confirmDiscard(() => navigation.dispatch(data.action));
  });
  return {
    allowLeave: () => {
      leaving.current = true;
    },
  };
}
