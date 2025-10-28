import { useDataNotifications } from "@/contexts/notifications";
import { useTheme } from "@/contexts/theme/useTheme";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { motion } from "framer-motion";
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAI } from "@/contexts/ai";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export const LastCoachMessageShower: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const { notifications, concludeNotification, markNotificationAsOpened } = useDataNotifications();
  const { isDarkMode } = useTheme();
  const { isUserFree } = usePaidPlan();
  const navigate = useNavigate();
  const { isUserAIWhitelisted, createChat } = useAI();
  const [isOpen, setIsOpen] = useState(false);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const activeToastId = useRef<string | null>(null);

  // Get the absolute latest coach notification, then check if it's not opened yet
  const latestCoachNotification = useMemo(() => {
    const latestCoach = notifications
      ?.filter((n) => n.type === "COACH")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

    // Only return it if it hasn't been opened (actively or passively dismissed)
    return latestCoach?.status !== "OPENED" && latestCoach?.status !== "CONCLUDED" ? latestCoach : null;
  }, [notifications]);

  // Detect if message is a question (serious) or casual statement
  const isQuestion = useMemo(() => {
    return latestCoachNotification?.message?.includes("?") ?? false;
  }, [latestCoachNotification]);

  const coachIcon = isDarkMode
    ? "/images/jarvis_logo_white_transparent.png"
    : "/images/jarvis_logo_transparent.png";

  const displayDuration = useMemo(() => {
    if (!latestCoachNotification?.message) return 3000;
    const wordCount = latestCoachNotification.message.split(/\s+/).length;
    return wordCount * 200;
  }, [latestCoachNotification]);

  const handleReply = useCallback(async () => {
    if (!latestCoachNotification) return;

    try {
      // Create new chat
      await createChat({
        title: null,
        initialCoachMessage: latestCoachNotification.message,
      });

      // Mark as concluded and close
      await concludeNotification({
        notificationId: latestCoachNotification.id,
        mute: true,
      });

      navigate({ to: "/ai" });
    } catch (error) {
      console.error("Failed to start chat with notification message:", error);
      // Fallback: just navigate to AI page
      navigate({ to: "/ai" });
    }
  }, [latestCoachNotification]);

  const handleDismiss = async () => {
    if (latestCoachNotification) {
      await concludeNotification({
        notificationId: latestCoachNotification.id,
        mute: true,
      });
      setIsOpen(false);
      onFinish();
    }
  };

  // Show toast for casual messages
  useEffect(() => {
    if (!isQuestion && latestCoachNotification) {
      // Dismiss any existing toast
      if (activeToastId.current) {
        toast.dismiss(activeToastId.current);
      }

      // Show new toast
      const toastId = toast.custom(
        (t) => (
          <div
            className={cn(
              t.visible ? "animate-enter" : "animate-leave",
              "max-w-md w-full bg-background shadow-2xl rounded-2xl pointer-events-auto border-2",
              variants.ring
            )}
            onClick={async () => {
              toast.dismiss(toastId);
              await handleReply();
            }}
          >
            <div className="flex items-start p-4 cursor-pointer hover:scale-[1.02] transition-transform">
              <div className="flex-shrink-0">
                <img src={coachIcon} alt="Coach" className="w-10 h-10" />
              </div>
              <div className="ml-3 flex-1">
                {latestCoachNotification.title && (
                  <h4 className="font-semibold text-sm text-foreground">
                    {latestCoachNotification.title}
                  </h4>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {latestCoachNotification.message}
                </p>
              </div>
            </div>
          </div>
        ),
        {
          duration: displayDuration,
          position: "top-center",
        }
      );

      activeToastId.current = toastId;

      // Auto-mark as opened when toast is dismissed (passive dismissal)
      const timeoutId = setTimeout(() => {
        markNotificationAsOpened([latestCoachNotification.id]);
        onFinish();
        activeToastId.current = null;
      }, displayDuration);

      return () => {
        clearTimeout(timeoutId);
        toast.dismiss(toastId);
      };
    }
  }, [latestCoachNotification, isQuestion, displayDuration, markNotificationAsOpened, coachIcon, variants.ring, handleReply]);

  // Only show for paid users and when there's a coach notification
  if (isUserFree || !isUserAIWhitelisted || !latestCoachNotification) {
    return null;
  }

  // Render serious question as drawer overlay
  if (isQuestion) {
    return (
      <Drawer.Root direction="top" open={latestCoachNotification.status !== "CONCLUDED"} onOpenChange={(isOpen: boolean) => !isOpen && handleDismiss()}>
        <Drawer.Overlay className="fixed inset-0 bg-black/60" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 top-0 bottom-auto",
            "mt-0 rounded-t-none rounded-b-[24px]",
            "max-h-[80vh] bg-background",
            "shadow-lg border-b"
          )}
        >
          <Drawer.Title className="sr-only">Coach Notification</Drawer.Title>

          <div className="p-6 space-y-4">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className={`w-16 h-16 rounded-2xl ${variants.bg} ${variants.ring} flex items-center justify-center mx-auto`}
            >
              <img src={coachIcon} alt="Coach" className="w-10 h-10" />
            </motion.div>

            {/* Title */}
            {latestCoachNotification.title && (
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xl font-bold text-center text-foreground"
              >
                {latestCoachNotification.title}
              </motion.h3>
            )}

            {/* Message */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-sm text-center text-muted-foreground"
            >
              {latestCoachNotification.message}
            </motion.p>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col items-center gap-2 pt-2"
            >
              <Button
                onClick={handleReply}
                className={`w-full ${variants.button.solid} font-semibold`}
                size="lg"
              >
                Reply
              </Button>
              <button
                onClick={handleDismiss}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Dismiss
              </button>
            </motion.div>
          </div>
        </Drawer.Content>
      </Drawer.Root>
    );
  }

  // Toast is rendered via useEffect, so just return null for casual messages
  return null;
};
