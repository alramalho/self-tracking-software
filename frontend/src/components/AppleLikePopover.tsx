import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface AppleLikePopoverProps {
  onClose: () => void;
  children: React.ReactNode;
  unclosable?: boolean;
  className?: string;
}

const AppleLikePopover: React.FC<AppleLikePopoverProps> = ({
  onClose,
  children,
  unclosable = false,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
    document.body.style.overflow = "hidden";
    
    // Clean up function to reset overflow when component unmounts
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);
  
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to finish
    document.body.style.overflow = "unset";
  };

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      <div
        ref={containerRef}
        className={`max-w-full max-h-full overflow-scroll mx-auto absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-20 transition-transform duration-300 ease-out ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-12 h-1 bg-gray-300 rounded mx-auto mb-6" />
        {!unclosable && (
          <Button
            variant="ghost"
          size="icon"
          className="absolute top-4 right-4"
          onClick={handleClose}
        >
          <X className="h-6 w-6" />
          </Button>
        )}
        {children}
      </div>
    </div>
  );
};

export default AppleLikePopover;