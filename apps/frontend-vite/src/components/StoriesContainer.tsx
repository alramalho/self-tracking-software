import { motion, AnimatePresence } from "framer-motion";
import { toPng } from "html-to-image";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Share, X, Check } from "lucide-react";

interface StoriesContainerProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export const StoriesContainer: React.FC<StoriesContainerProps> = ({
  children,
  onClose,
}) => {
  const stories = useMemo(
    () => React.Children.toArray(children),
    [children]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);
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
    const threshold = rect.width * 0.3;

    if (x < threshold) {
      goPrev();
    } else if (x > rect.width - threshold) {
      goNext();
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!storyRef.current || isSharing) return;

    setIsSharing(true);
    try {
      const dataUrl = await toPng(storyRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "wrapped.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My 2025 Wrapped",
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } else {
        const link = document.createElement("a");
        link.download = "wrapped.png";
        link.href = dataUrl;
        link.click();
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to share:", error);
      }
    } finally {
      setIsSharing(false);
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

      {/* Top buttons */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-1">
        <button
          onClick={handleShare}
          disabled={isSharing}
          className="p-2 text-white/80 hover:text-white transition-colors"
        >
          {shareSuccess ? (
            <Check size={24} className="text-green-400" />
          ) : (
            <Share size={24} className={isSharing ? "animate-pulse" : ""} />
          )}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        )}
      </div>

      {/* Story content with tap zones */}
      <div
        className="flex-1 relative overflow-hidden"
        onClick={handleTap}
      >
        <div className="absolute inset-y-0 left-0 w-[30%] z-10 cursor-pointer pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-[30%] z-10 cursor-pointer pointer-events-none" />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            ref={storyRef}
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
