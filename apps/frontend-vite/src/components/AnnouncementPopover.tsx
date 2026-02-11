import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { Iphone } from "@/components/ui/iphone";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import React, { useEffect, useState } from "react";

interface AnnouncementPopoverProps {
  id: string; // unique identifier for localStorage key
  title: string | React.ReactNode;
  icon: React.ReactNode;
  description: string | React.ReactNode;
  imageSrcs?: string[]; // optional screenshots to display in iPhone mockups (horizontally scrollable)
  actionLabel: string;
  onAction: () => void;
  open?: boolean; // allow external control
  onClose?: () => void; // callback when manually closed
}

export const AnnouncementPopover: React.FC<AnnouncementPopoverProps> = ({
  id,
  title,
  icon,
  description,
  imageSrcs,
  actionLabel,
  onAction,
  open: controlledOpen,
  onClose,
}) => {
  const [dismissed, setDismissed] = useLocalStorage<boolean>(
    `announcement-${id}-dismissed`,
    false
  );
  const [isOpen, setIsOpen] = useState(false);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Auto-open on mount if not dismissed and not externally controlled
  useEffect(() => {
    if (controlledOpen === undefined && !dismissed) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [controlledOpen, dismissed]);

  const handleClose = () => {
    setIsOpen(false);
    setDismissed(true);
    onClose?.();
  };

  const handleAction = () => {
    onAction();
    handleClose();
  };

  const open = controlledOpen !== undefined ? controlledOpen : isOpen;

  if (dismissed && controlledOpen === undefined) {
    return null;
  }

  return (
    <AppleLikePopover
      onClose={handleClose}
      open={open}
      title={title}
      displayIcon={false}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative ${imageSrcs && imageSrcs.length > 0 ? 'pb-0' : 'p-6'}`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted/50 transition-colors z-20"
          aria-label="Dismiss"
        >
          <X size={20} className="text-muted-foreground" />
        </button>

        {/* Scrollable content wrapper */}
        <div className={imageSrcs && imageSrcs.length > 0 ? 'max-h-[70vh] overflow-y-auto' : ''}>
          <div className={imageSrcs && imageSrcs.length > 0 ? 'p-6 pb-32' : ''}>
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className={`w-16 h-16 rounded-2xl ${variants.bg} ${variants.ring} flex items-center justify-center mb-4 mx-auto`}
            >
              {icon}
            </motion.div>

            {/* Title */}
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl font-bold text-center text-foreground mb-2"
            >
              {title}
            </motion.h3>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`text-sm text-center text-muted-foreground ${imageSrcs && imageSrcs.length > 0 ? 'mb-4' : 'mb-6'}`}
            >
              {description}
            </motion.div>

            {/* Optional Images/Screenshots - Horizontal Scroll */}
            {imageSrcs && imageSrcs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {/* Horizontal scroll container */}
                <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-4 px-2">
                  {imageSrcs.map((src, index) => (
                    <div key={index} className="flex-shrink-0 snap-center w-[280px] sm:w-[320px]">
                      <Iphone src={src} />
                    </div>
                  ))}
                </div>
                {/* Pagination dots */}
                {imageSrcs.length > 1 && (
                  <div className="flex justify-center gap-2 mt-2">
                    {imageSrcs.map((_, index) => (
                      <div
                        key={index}
                        className="w-2 h-2 rounded-full bg-muted-foreground/30"
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Gradient fade and Action button (fixed to bottom when image exists) */}
        {imageSrcs && imageSrcs.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
          >
            {/* Gradient overlay */}
            <div className="h-32 bg-gradient-to-t from-background via-background/80 to-transparent" />

            {/* Button */}
            <div className="px-6 pb-6 bg-background pointer-events-auto">
              <Button
                onClick={handleAction}
                className={`w-full ${variants.button.solid} font-semibold`}
              >
                {actionLabel}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              onClick={handleAction}
              className={`w-full ${variants.button.solid} font-semibold`}
            >
              {actionLabel}
            </Button>
          </motion.div>
        )}
      </motion.div>
    </AppleLikePopover>
  );
};
