import AppleLikePopover from "@/components/AppleLikePopover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Wand2, Undo2 } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

interface FeedbackAnnouncementPopoverProps {
  open: boolean;
  userName: string;
  userPicture: string | null;
  activityEntryCount: number;
  onSubmit: (data: {
    sentiment: number;
    message: string;
    wasRewritten: boolean;
  }) => Promise<void>;
}

const SENTIMENT_OPTIONS = [
  { emoji: "😭", value: 1, label: "Very unhappy" },
  { emoji: "😞", value: 2, label: "Unhappy" },
  { emoji: "🙂", value: 3, label: "Happy" },
  { emoji: "🤩", value: 4, label: "Very happy" },
];

export const FeedbackAnnouncementPopover: React.FC<FeedbackAnnouncementPopoverProps> = ({
  open,
  userName,
  userPicture,
  activityEntryCount,
  onSubmit,
}) => {
  const [completed, setCompleted] = useLocalStorage<boolean>(
    "feedback-announcement-completed",
    false
  );
  const [selectedSentiment, setSelectedSentiment] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [previousMessage, setPreviousMessage] = useState<string | null>(null);
  const [wasRewritten, setWasRewritten] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Extract first name from full name
  const firstName = userName.split(" ")[0];

  const messageLength = message.length;
  const showAIButton = messageLength >= 30;
  const canUndo = previousMessage !== null;

  // Auto-resize textarea with one line buffer
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to recalculate
    textarea.style.height = "auto";

    // Set height to scrollHeight + one line buffer (approximately 24px for one line)
    const newHeight = textarea.scrollHeight + 24;
    textarea.style.height = `${newHeight}px`;
  }, [message]);

  const handleRewriteWithAI = async () => {
    if (!message.trim() || !selectedSentiment) return;

    setIsRewriting(true);
    try {
      const api = (await import("@/lib/api")).default;
      const response = await api.post("/ai/rewrite-testimonial", {
        sentiment: selectedSentiment,
        message: message.trim(),
      });

      // Store current message before replacing
      setPreviousMessage(message);
      setMessage(response.data.message);
      setWasRewritten(true);
    } catch (error) {
      console.error("Failed to rewrite message:", error);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleUndo = () => {
    if (previousMessage) {
      setMessage(previousMessage);
      setPreviousMessage(null);
      setWasRewritten(false);
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() || !selectedSentiment) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        sentiment: selectedSentiment,
        message: message.trim(),
        wasRewritten,
      });
      setCompleted(true);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = selectedSentiment !== null && message.trim().length > 0;

  if (completed) {
    return null;
  }

  return (
    <AppleLikePopover
      onClose={() => {}} // No-op since it's unclosable
      open={open}
      title="We need your help!"
      unclosable={true}
      displayIcon={false}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="p-6 px-3"
      >
        {/* Avatar, Heart, and App Icon */}
        <div className="flex justify-center items-center gap-2 mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <Avatar className="w-14 h-14">
              <AvatarImage src={userPicture || ""} alt={userName} />
              <AvatarFallback className="text-xl">
                {firstName[0]}
              </AvatarFallback>
            </Avatar>
          </motion.div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          >
            <Heart className="w-6 h-6 fill-red-500 text-red-500" />
          </motion.div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
          >
            <img
              src="/icons/icon-transparent.png"
              alt="tracking.so"
              className="w-14 h-14"
            />
          </motion.div>
        </div>

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="text-xl font-bold text-center text-foreground mb-2"
        >
          We need your help, {firstName}!
        </motion.h3>

        {/* Description */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-sm text-center text-muted-foreground mb-6"
        >
          Thank you for logging{" "}
          <span className="font-semibold text-foreground">{activityEntryCount} activities</span> in tracking.so<br/>
          We'd love to add your feedback as a testimonial on our website!
        </motion.div>

        {/* Sentiment Selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <p className="text-sm font-medium text-foreground mb-3 text-center">
            How do you feel about tracking.so?
          </p>
          <div className="flex justify-center gap-3">
            {SENTIMENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedSentiment(option.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                  selectedSentiment === option.value
                    ? `${variants.bg} ${variants.ring} scale-110`
                    : "hover:bg-muted/50"
                }`}
                title={option.label}
              >
                <span className="text-3xl">{option.emoji}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Testimonial Textarea */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-4"
        >
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium text-foreground">
              What do you {selectedSentiment === 1 ? "dislike" : selectedSentiment === 2 ? "don't like" : selectedSentiment === 3 ? "like" : "love"} about tracking.so?
            </p>
            <span className="text-xs text-muted-foreground">
              {messageLength} characters
            </span>
          </div>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={[1,2].includes(selectedSentiment || 0) ? "For example: confusing interface, too many bugs, etc..." : "For example: great interface, helps me staying motivated, etc..."}
              className="w-full min-h-[120px] resize-none pb-12"
              disabled={!selectedSentiment}
            />
            {/* AI Rewrite / Undo Button */}
            <AnimatePresence>
              {showAIButton && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute bottom-3 right-3"
                >
                  {canUndo ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUndo}
                      className="gap-2"
                    >
                      <Undo2 className="w-4 h-4" />
                      Undo AI Rewrite
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRewriteWithAI}
                      disabled={isRewriting}
                      className="gap-2"
                    >
                      <Wand2 className="w-4 h-4" />
                      {isRewriting ? "Rewriting..." : "Rewrite with AI"}
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={`w-full ${variants.button.solid} font-semibold`}
          >
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
          {!canSubmit && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              {!selectedSentiment && "Please select how you feel"}
              {selectedSentiment && !message.trim() && "Please write your testimonial"}
            </p>
          )}
        </motion.div>
      </motion.div>
    </AppleLikePopover>
  );
};
