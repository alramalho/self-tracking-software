import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

// The composer drops its home-indicator inset while the keyboard covers it.
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const listeners = [
      Keyboard.addListener(show, () => setVisible(true)),
      Keyboard.addListener(hide, () => setVisible(false)),
    ];
    return () => listeners.forEach((listener) => listener.remove());
  }, []);
  return visible;
}
