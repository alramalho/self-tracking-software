import { getCoachPersonalityConfig } from "@/lib/coachPersonality";

/** The coach as a clay figure, as on iPhone: the Coach tab's icon and header. */
export const coachFace = (personality?: string | null) =>
  getCoachPersonalityConfig(personality).id === "STRATEGIST"
    ? "/images/coaches/3d/oli.png"
    : "/images/coaches/3d/helly.png";
