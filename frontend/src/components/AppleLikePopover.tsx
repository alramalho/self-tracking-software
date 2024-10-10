import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface AppleLikePopoverProps {
  onClose: () => void;
  children: React.ReactNode;
}

const AppleLikePopover: React.FC<AppleLikePopoverProps> = ({
  onClose,
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to finish
  };

  const handleSwipeUp = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    const startY = touch.pageY;
    const handleTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0].pageY;
      if (startY - endY > 50) {
        // Swipe up threshold
        handleClose();
      }
      document.removeEventListener("touchend", handleTouchEnd);
    };
    document.addEventListener("touchend", handleTouchEnd);
  };

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <div
        ref={containerRef}
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-20 transition-transform duration-300 ease-out ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxWidth: "500px", margin: "0 auto" }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleSwipeUp}
      >
        <div className="w-12 h-1 bg-gray-300 rounded mx-auto mb-6" />
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4"
          onClick={handleClose}
        >
          <X className="h-6 w-6" />
        </Button>
        {children}
      </div>
    </div>
  );
};

export default AppleLikePopover;