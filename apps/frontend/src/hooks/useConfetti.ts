import confetti from "canvas-confetti";

const useConfetti = () => {
  const stars = (data: { colors?: string[] }) => {
    const { colors = ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"] } =
      data;
    const defaults = {
      spread: 360,
      ticks: 50,
      gravity: 0,
      decay: 0.94,
      startVelocity: 30,
      colors,
    };

    const shoot = () => {
      confetti({
        ...defaults,
        particleCount: 40,
        scalar: 1.2,
        shapes: ["star"],
      });

      confetti({
        ...defaults,
        particleCount: 10,
        scalar: 0.75,
        shapes: ["circle"],
      });
    };

    setTimeout(shoot, 0);
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
  };
  const sideCannons = (data: { duration?: number; colors?: string[] }) => {
    const {
      duration = 3000,
      colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"],
    } = data;
    const end = Date.now() + duration;

    const frame = () => {
      if (Date.now() > end) return;

      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        startVelocity: 60,
        origin: { x: 0, y: 0.5 },
        colors: colors,
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        startVelocity: 60,
        origin: { x: 1, y: 0.5 },
        colors: colors,
      });

      requestAnimationFrame(frame);
    };

    frame();
  };

  return { sideCannons, stars };
};

export default useConfetti;
