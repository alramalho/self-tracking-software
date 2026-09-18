import { requireNativeView } from "expo";
import { Platform, type ViewProps } from "react-native";
import type { ComponentType } from "react";

export type TrackingMapProps = ViewProps & {
  dark: boolean;
  routeJSON: string;
};

const NativeTrackingMap: ComponentType<TrackingMapProps> | null =
  Platform.OS === "ios"
    ? requireNativeView<TrackingMapProps>("TrackingMap")
    : null;

export function TrackingMap(props: TrackingMapProps) {
  if (!NativeTrackingMap) return null;
  return <NativeTrackingMap {...props} />;
}
