export function coachIdentity(personality?: string) {
  return personality === "STRATEGIST"
    ? {
        name: "Oli",
        title: "The Strategist",
        avatar: "https://app.tracking.so/images/coaches/oli/01_neutral.png",
      }
    : {
        name: "Helly",
        title: "The Champion",
        avatar: "https://app.tracking.so/images/coaches/helly/01_neutral.png",
      };
}
