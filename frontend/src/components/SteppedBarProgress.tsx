import React, { useState, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AnimatePresence } from "framer-motion";

interface SteppedBarProgressProps {
  value: number;
  maxValue: number;
  goal: string | React.ReactNode;
  className?: string;
  onFullyDone?: () => void;
  color?: string;
  celebration?: string | React.ReactNode;
}

export const SteppedBarProgress: React.FC<SteppedBarProgressProps> = ({
  value,
  maxValue,
  goal,
  className,
  celebration,
  color = "bg-green-500",
  onFullyDone,
}) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  const [isFullyDone, setIsFullyDone] = useState(false);

  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
  });

  useEffect(() => {
    console.log("isFullyDone", isFullyDone);
  }, [isFullyDone]);

  useEffect(() => {
    if (inView) {
      const timer = setInterval(() => {
        setAnimatedValue((prev) => {
          if (prev < value) {
            return prev + 1;
          }
          clearInterval(timer);
          console.log({ prev, maxValue });
          if (prev >= maxValue) {
            setIsFullyDone(true);
            console.log("inside onFullyDone");
            onFullyDone?.();
          }
          return prev;
        });
      }, 300);

      return () => clearInterval(timer);
    }
  }, [inView, value, maxValue]);

  return (
    <div ref={ref} className={cn("flex flex-col gap-1", className)}>
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {Array.from({ length: maxValue }, (_, index) => (
            <div
              key={index}
              className={cn(
                "flex-1 h-2 rounded transition-all",
                index < animatedValue ? color : "bg-gray-200",
                isFullyDone ? "animate-pulse duration-1300" : "duration-300"
              )}
            />
          ))}
        </div>
        <span className="text-lg flex-shrink-0">{goal}</span>
      </div>

      <AnimatePresence>
        {isFullyDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="flex w-full flex-row items-center justify-between text-xs text-gray-700 gap-2"
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
    </div>
  );
};
