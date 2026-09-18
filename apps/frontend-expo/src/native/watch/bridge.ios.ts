import { requireNativeModule } from "expo";
import type { WatchBridge } from "./types";
export const watchBridge = requireNativeModule<WatchBridge>("TrackingWatch");
