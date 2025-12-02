import AppleLikePopover from "@/components/AppleLikePopover";
import MultiPhotoUploader from "@/components/ui/MultiPhotoUploader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAchievements } from "@/contexts/achievements";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import React, { useState, useEffect } from "react";

interface AchievementEditDialogProps {
  open: boolean;
  onClose: () => void;
  achievementPostId: string;
  currentMessage?: string | null;
  planEmoji?: string;
}

export const AchievementEditDialog: React.FC<AchievementEditDialogProps> = ({
  open,
  onClose,
  achievementPostId,
  currentMessage,
  planEmoji,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { updateAchievementPost, isUpdatingAchievementPost } = useAchievements();
  const [message, setMessage] = useState(currentMessage || "");

  // Reset message when dialog opens
  useEffect(() => {
    if (open) {
      setMessage(currentMessage || "");
    }
  }, [open, currentMessage]);

  const handleSave = async () => {
    try {
      await updateAchievementPost({
        achievementPostId,
        message: message.trim() || undefined,
      });
      onClose();
    } catch (error) {
      // Error is handled in the context
    }
  };

  return (
    <AppleLikePopover
      onClose={onClose}
      open={open}
      title="Edit Achievement"
      displayIcon={false}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative p-6 pb-4"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center text-5xl mb-3">
            {planEmoji || "🎖️"}
          </div>
        </div>

        {/* Edit form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Message
            </label>
            <Textarea
              placeholder="Add a message about your achievement (optional)..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px] resize-none"
              disabled={isUpdatingAchievementPost}
            />
          </div>

          {/* TODO: Photo editing could be added here in the future */}
          {/* <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Photos
            </label>
            <MultiPhotoUploader
              onFilesChange={setPhotos}
              maxFiles={10}
              disabled={isUpdatingAchievementPost}
            />
          </div> */}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleSave}
            className={`w-full ${variants.button.solid} font-semibold`}
            disabled={isUpdatingAchievementPost}
          >
            {isUpdatingAchievementPost ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full"
            disabled={isUpdatingAchievementPost}
          >
            Cancel
          </Button>
        </div>
      </motion.div>
    </AppleLikePopover>
  );
};

export default AchievementEditDialog;
