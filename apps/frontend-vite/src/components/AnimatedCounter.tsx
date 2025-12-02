import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useDebounce } from "@uidotdev/usehooks";
import { NumberTicker } from "./NumberTicker";
import JSConfetti from "js-confetti";

interface AnimatedCounterProps {
  count: number;
  emoji: string;
  label?: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  count,
  emoji,
  label,
}) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [key, setKey] = useState(0);
  const debouncedCount = useDebounce(count, 100);
  const jsConfettiRef = useRef<JSConfetti | null>(null);
  const clickCountRef = useRef(0);

  useEffect(() => {
    // Initialize JSConfetti once
    jsConfettiRef.current = new JSConfetti();

    return () => {
      // Cleanup on unmount
      jsConfettiRef.current?.clearCanvas();
    };
  }, []);

  useEffect(() => {
    // Trigger re-render when debounced count changes
    setKey(prev => prev + 1);
  }, [debouncedCount]);

  const triggerAnimation = () => {
    setShouldAnimate(true);
    setTimeout(() => setShouldAnimate(false), 600);
  };

  const handleClick = () => {
    // Tap animation
    triggerAnimation();

    // Increment click counter
    clickCountRef.current += 1;

    // Trigger confetti every 5 clicks
    if (clickCountRef.current % 5 === 0 && jsConfettiRef.current) {
      const shootConfetti = () => {
        jsConfettiRef.current?.addConfetti({
          emojis: ['🔥'],
          emojiSize: 50,
          confettiNumber: 70,
        });
      };

      shootConfetti();
    }
  };

  const handleCountComplete = () => {
    // Trigger the shake animation when count-up finishes
    triggerAnimation();
  };

  return (
    <div
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-black/30 backdrop-blur-md border border-white/20 shadow-lg cursor-pointer active:scale-95 transition-transform"
    >
      <motion.span
        className="text-2xl"
        animate={
          shouldAnimate
            ? {
                scale: [1, 1.3, 1],
                rotate: [0, -10, 10, 0],
              }
            : {}
        }
        transition={{
          duration: 0.6,
          ease: "easeOut",
        }}
      >
        {emoji}
      </motion.span>
      <div className="flex flex-col items-start leading-none">
        <NumberTicker
          key={key}
          value={debouncedCount}
          className="text-lg font-bold text-white font-geist-mono"
          delay={0}
          onAnimationComplete={handleCountComplete}
        />
        {label && (
          <span className="text-[10px] text-white/80 uppercase tracking-wide font-medium">
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

export default AnimatedCounter;
