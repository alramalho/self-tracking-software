import { useDataNotifications } from "@/contexts/notifications";
import { useTheme } from "@/contexts/theme/useTheme";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAI } from "@/contexts/ai";

export const FloatingCoachWidget: React.FC = () => {
  const { notifications, concludeNotification } = useDataNotifications();
  const { isDarkMode } = useTheme();
  const { isUserFree } = usePaidPlan();
  const navigate = useNavigate();
  const { isUserAIWhitelisted, createChat } = useAI();
  const [isOpen, setIsOpen] = useState(false);

  // Get the most recent coach notification (regardless of status)
  const latestCoachNotification = useMemo(() => {
    return notifications
      ?.filter((n) => n.type === "COACH")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
  }, [notifications]);

  const coachIcon = isDarkMode
    ? "/images/jarvis_logo_white_transparent.png"
    : "/images/jarvis_logo_transparent.png";

  const handleReply = async () => {
    if (!latestCoachNotification) return;

    try {
      // Create new chat
      const newChat = await createChat({
        title: null,
        initialCoachMessage: latestCoachNotification.message,
      });

      // Navigate to AI page (chat will already be selected and message sent)
      navigate({ to: "/ai" });
    } catch (error) {
      console.error("Failed to start chat with notification message:", error);
      // Fallback: just navigate to AI page
      navigate({ to: "/ai" });
    }
  };

  const handleClose = async () => {
    if (latestCoachNotification) {
      await concludeNotification({
        notificationId: latestCoachNotification.id,
        mute: true,
      });
      setIsOpen(false);
    }
  };

  // Only show for paid users and when there's a non-concluded coach notification
  if (
    isUserFree ||
    !isUserAIWhitelisted ||
    !latestCoachNotification ||
    latestCoachNotification.status === "CONCLUDED"
  ) {
    return null;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {!isOpen ? (
          // Closed State - Just Avatar with Glass Badge
          <motion.div
            key="closed"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-28 right-6 z-50"
          >
            <button
              onClick={() => setIsOpen(true)}
              className="relative w-16 h-16 rounded-fullhover:scale-105 transition-all duration-200"
            >
              <img
                src={coachIcon}
                alt="AI Coach"
                className="w-16 h-16 rounded-full"
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -left-1 w-6 h-6 bg-red-500/90 backdrop-blur-md text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white/20"
              >
                1
              </motion.div>
            </button>
          </motion.div>
        ) : (
          // Expanded State - Bottom Fixed Glass Card
          <motion.div
            key="open"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-6 pb-8 bg-background/30 backdrop-blur-xl border-t border-border/50 rounded-3xl shadow-2xl mb-23 border-1 mx-2 border-white/30 dark:border-gray-500/10"
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 p-2 bg-foreground/5 rounded-full transition-colors"
              aria-label="Close notification"
            >
              <X
                size={20}
                className="text-foreground/60 hover:text-foreground"
              />
            </button>

            {/* Message Content */}
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center gap-2">
                <img
                  src={coachIcon}
                  alt="AI Coach"
                  className="w-7 h-7 rounded-full"
                />
                <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                  {latestCoachNotification.title}
                </p>
              </div>
              <p className="text-base text-foreground/90 leading-relaxed font-light">
                {latestCoachNotification.message}
              </p>

              {/* Reply Button */}
              <button
                onClick={handleReply}
                className="w-full bg-foreground/10 backdrop-blur-sm hover:bg-foreground/15 border border-foreground/10 rounded-2xl p-4 font-medium text-foreground flex items-center justify-center gap-2 transition-all"
              >
                Reply <ChevronRight size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
