import { useDataNotifications } from "@/contexts/notifications";
import { useTheme } from "@/contexts/theme/useTheme";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MessageBubble } from "./MessageBubble";
import { useCurrentUser } from "@/contexts/users";
import { useAI } from "@/contexts/ai";

export const FloatingCoachWidget: React.FC = () => {
  const { notifications, concludeNotification } = useDataNotifications();
  const { isDarkMode } = useTheme();
  const { isUserFree } = usePaidPlan();
  const {currentUser} = useCurrentUser();
  const navigate = useNavigate();
  const {isUserAIWhitelisted} = useAI();
  const [isOpen, setIsOpen] = useState(false);

  // Get the most recent unread coach notification
  const latestCoachNotification = useMemo(() => {
    return notifications
      ?.filter((n) => n.type === "COACH" && n.status !== "CONCLUDED")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
  }, [notifications]);

  const coachIcon = isDarkMode
    ? "/images/jarvis_logo_white_transparent.png"
    : "/images/jarvis_logo_transparent.png";

  const handleReply = () => {
    navigate({ to: "/ai" });
  };

  const handleClose = async () => {
    if (latestCoachNotification) {
      await concludeNotification({
        notificationId: latestCoachNotification.id,
        mute: true
      });
      setIsOpen(false);
    }
  };

  // Only show for paid users and when there's a coach notification
  if (isUserFree || !isUserAIWhitelisted || !latestCoachNotification) {
    return null;
  }

  return (
    <div className="fixed bottom-28 right-6 z-50">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          // Closed State - Just Avatar with Badge
          <motion.button
            key="closed"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={() => setIsOpen(true)}
            className="relative w-16 h-16 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <img
              src={coachIcon}
              alt="AI Coach"
              className="w-16 h-16 rounded-full"
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -left-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-background"
            >
              1
            </motion.div>
          </motion.button>
        ) : (
          // Expanded State - Chat Bubble + Reply Button + Avatar
          <motion.div
            key="open"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex flex-col items-end gap-3 max-w-sm relative"
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute -top-2 -right-2 p-1.5 hover:bg-muted rounded-full transition-colors self-end bg-background border border-border"
              aria-label="Close notification"
            >
              <X size={16} className="text-muted-foreground hover:text-foreground" />
            </button>

            {/* Chat Bubble Message */}
            <MessageBubble direction="right" className="max-w-xs">
              <div className="space-y-1">
                {latestCoachNotification.title && (
                  <p className="font-semibold text-sm text-foreground">
                    {latestCoachNotification.title}
                  </p>
                )}
                <p className="text-sm text-foreground/90">
                  {latestCoachNotification.message}
                </p>
              </div>
            </MessageBubble>

            {/* Reply Button + Avatar Row */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleReply}
                className="text-sm bg-background border border-border rounded-md p-2 font-medium text-foreground/70 hover:text-foreground flex items-center gap-1 transition-colors"
              >
                Reply <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-16 h-16 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 bg-background border border-border"
              >
                <img
                  src={coachIcon}
                  alt="AI Coach"
                  className="w-16 h-16 rounded-full"
                />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
