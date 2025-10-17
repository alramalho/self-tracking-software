"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface BarProgressLoaderProps {
  durationSeconds: number;
  onComplete?: () => void;
  className?: string;
}

export const BarProgressLoader = ({ 
  durationSeconds, 
  onComplete,
  className = "w-full max-w-xs"
}: BarProgressLoaderProps) => {
  const [progress, setProgress] = useState<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgressAnimation = () => {
    const startTime = Date.now();
    const targetProgress = 99;
    const duration = durationSeconds * 1000; // Convert to milliseconds

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const timeRatio = elapsed / duration;

      // Logarithmic progress: fast at start, slows down towards target
      const logarithmicProgress = targetProgress * (1 - Math.exp(-timeRatio * 3));

      if (logarithmicProgress >= targetProgress || elapsed >= duration) {
        setProgress(targetProgress);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        onComplete?.();
      } else {
        setProgress(Math.floor(logarithmicProgress));
      }
    }, 100); // Update every 100ms
  };

  // const stopProgressAnimation = () => {
  //   if (progressIntervalRef.current) {
  //     clearInterval(progressIntervalRef.current);
  //     progressIntervalRef.current = null;
  //   }
  //   setProgress(100);
  //   onComplete?.();
  // };

  useEffect(() => {
    setProgress(0);
    startProgressAnimation();

    // Cleanup effect
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [durationSeconds]);

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <div className="w-full bg-muted rounded-full h-2">
        <motion.div
          className="bg-blue-600 h-2 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
};