import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

interface SteppedBarProgressProps {
  value: number;
  maxValue: number;
  goal: string | React.ReactNode;
  className?: string;
  onAnimationCompleted?: () => void;
  onFullyDone?: () => void;
  color?: string;
  emptyColor?: string;
  celebration?: string | React.ReactNode;
  skipAnimation?: boolean;
  compact?: boolean;
}

export const SteppedBarProgress: React.FC<SteppedBarProgressProps> = ({
  value,
  maxValue,
  goal,
  className,
  celebration,
  color = "bg-green-500",
  emptyColor,
  onAnimationCompleted,
  onFullyDone,
  skipAnimation = false,
  compact = false,
}) => {
  const effectiveSkipAnimation = skipAnimation || compact;
  const [animatedValue, setAnimatedValue] = useState(effectiveSkipAnimation ? value : 0);
  const [isFullyDone, setIsFullyDone] = useState(effectiveSkipAnimation && value >= maxValue);
  const [shouldCallCompleted, setShouldCallCompleted] = useState(effectiveSkipAnimation);

  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
  });

  useEffect(() => {
    if (effectiveSkipAnimation) {
      return;
    }
    
    if (inView) {
      const timer = setInterval(() => {
        setAnimatedValue((prev) => {
          if (prev < value) {
            return prev + 1;
          }
          clearInterval(timer);
          setShouldCallCompleted(true);
          if (prev >= maxValue) {
            setIsFullyDone(true);
            onFullyDone?.();
          }
          return prev;
        });
      }, 300);

      return () => clearInterval(timer);
    }
  }, [inView, value, maxValue, onFullyDone, skipAnimation]);

  useEffect(() => {
    if (shouldCallCompleted) {
      onAnimationCompleted?.();
      setShouldCallCompleted(false);
    }
  }, [shouldCallCompleted, onAnimationCompleted]);

  return (
    <div ref={ref} className={cn("flex flex-col gap-0", className)}>
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className={cn(
          compact ? "flex flex-wrap gap-1" : "flex gap-1 flex-1"
        )}>
          {Array.from({ length: maxValue }, (_, index) => (
            <div
              key={index}
              className={cn(
                "rounded transition-all",
                compact ? "w-3.5 h-3.5" : "flex-1 h-2",
                index < animatedValue
                  ? color
                  : emptyColor ?? (compact ? "bg-muted-foreground/25" : "bg-background"),
                isFullyDone ? "animate-pulse duration-1300" : "duration-300"
              )}
            />
          ))}
        </div>
        <span className={cn("flex-shrink-0", compact ? "text-sm" : "text-lg")}>{goal}</span>
      </div>

      {!compact && (
        <AnimatePresence>
          {isFullyDone && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="flex w-full flex-row items-center justify-between text-xs text-foreground gap-2"
            >
              {typeof celebration === "string" ? (
                <span className="mt-1 text-sm font-normal text-green-600">
                  {celebration}
                </span>
              ) : (
                celebration
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};
