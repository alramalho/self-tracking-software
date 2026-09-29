// The coaches as clay figures. Helly's thumbs-up plays once when she approves an answer.
export const coachAvatar = (strategist: boolean) =>
  strategist
    ? require("../../../assets/coaches/oli-3d.png")
    : require("../../../assets/coaches/helly-3d.png");

export const hellyThumbsUp = require("../../../assets/coaches/helly-3d-thumbs-up.webp");
