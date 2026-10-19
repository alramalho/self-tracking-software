// The coaches as clay figures. Helly's thumbs-up plays once when she approves an answer.
export const coachAvatar = (strategist: boolean) =>
  strategist
    ? require("../../../assets/coaches/oli-3d.png")
    : require("../../../assets/coaches/helly-3d.png");

export const hellyThumbsUp = require("../../../assets/coaches/helly-3d-thumbs-up.webp");

// Sized for the tab bar (30 pt, with @2x and @3x): the tab shows the coach's face.
export const coachTabIcon = (strategist: boolean) =>
  strategist
    ? require("../../../assets/coaches/tab/oli.png")
    : require("../../../assets/coaches/tab/helly.png");
