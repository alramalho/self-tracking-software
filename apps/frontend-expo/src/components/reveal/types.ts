import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
export interface RevealProps {
  children: ReactNode;
  id?: string;
  delay?: number;
  duration?: number;
  offset?: number;
  maxDelay?: number;
  testID?: string;
  waitForViewport?: boolean;
  onReveal?: (reducedMotion: boolean) => void;
  style?: StyleProp<ViewStyle>;
}
export interface RevealViewport {
  seen: Set<string>;
  register: (check: () => void) => () => void;
  check: () => void;
}
