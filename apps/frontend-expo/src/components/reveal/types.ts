import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
export interface RevealProps {
  children: ReactNode;
  id?: string;
  delay?: number;
  onReveal?: (reducedMotion: boolean) => void;
  style?: StyleProp<ViewStyle>;
}
export interface RevealViewport {
  seen: Set<string>;
  register: (check: () => void) => () => void;
  check: () => void;
}
