import { requireOptionalNativeModule } from "expo";
import type { AppleHealthPlugin } from "./types";
export const healthBridge =
  requireOptionalNativeModule<AppleHealthPlugin>("TrackingHealth");
