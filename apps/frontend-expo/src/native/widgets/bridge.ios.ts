import { requireOptionalNativeModule } from "expo";
import type { WidgetBridge } from "./types";
// Older development binaries remain usable until they are rebuilt with the extension.
export const widgetBridge: WidgetBridge = requireOptionalNativeModule<WidgetBridge>("TrackingWidgets") ?? {
  setAccount: async () => {},
  setSnapshot: async () => {},
};
