import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useCallback, useMemo } from "react";
import { X } from "lucide-react";

interface StoriesContainerProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export const StoriesContainer: React.FC<StoriesContainerProps> = ({
  children,
  onClose,
}) => {
  // Flatten children array (handles mapped elements)
  const stories = useMemo(
    () => React.Children.toArray(children),
    [children]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const totalStories = stories.length;

  const goNext = useCallback(() => {
    if (currentIndex < totalStories - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (onClose) {
      onClose();
    }
  }, [currentIndex, totalStories, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const threshold = rect.width * 0.3; // 30% on each side

    if (x < threshold) {
      goPrev();
    } else if (x > rect.width - threshold) {
      goNext();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2 pt-3">
        {stories.map((_, idx) => (
          <div
            key={idx}
            className="flex-1 h-1 rounded-full overflow-hidden bg-white/30"
          >
            <motion.div
              className="h-full bg-white"
              initial={{ width: idx < currentIndex ? "100%" : "0%" }}
              animate={{
                width: idx < currentIndex ? "100%" : idx === currentIndex ? "100%" : "0%",
              }}
              transition={{
                duration: idx === currentIndex ? 0.3 : 0,
                ease: "easeOut",
              }}
            />
          </div>
        ))}
      </div>

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 text-white/80 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      )}

      {/* Story content with tap zones */}
      <div
        className="flex-1 relative overflow-hidden"
        onClick={handleTap}
      >
        {/* Tap zone indicators (invisible, for accessibility) */}
        <div className="absolute inset-y-0 left-0 w-[30%] z-10 cursor-pointer" />
        <div className="absolute inset-y-0 right-0 w-[30%] z-10 cursor-pointer" />

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-0 overflow-y-auto"
          >
            {stories[currentIndex]}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
};

export default StoriesContainer;
