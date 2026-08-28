import { registerPlugin } from "@capacitor/core";

import type { AppleHealthPlugin } from "./types";

export const AppleHealth = registerPlugin<AppleHealthPlugin>("AppleHealth");
