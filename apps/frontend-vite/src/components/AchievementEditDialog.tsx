import AppleLikePopover from "@/components/AppleLikePopover";
import MultiPhotoUploader from "@/components/ui/MultiPhotoUploader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAchievements } from "@/contexts/achievements";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import React, { useState, useEffect } from "react";

interface ExistingImage {
  id: string;
  url: string;
}

interface AchievementEditDialogProps {
  open: boolean;
  onClose: () => void;
  achievementPostId: string;
  currentMessage?: string;
  currentImages?: ExistingImage[];
  planEmoji?: string;
}

export const AchievementEditDialog: React.FC<AchievementEditDialogProps> = ({
  open,
  onClose,
  achievementPostId,
  currentMessage,
  currentImages = [],
  planEmoji,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { updateAchievementPost, isUpdatingAchievementPost } = useAchievements();
  const [message, setMessage] = useState(currentMessage || "");
  const [imagesToKeep, setImagesToKeep] = useState<ExistingImage[]>(currentImages);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMessage(currentMessage || "");
      setImagesToKeep(currentImages);
      setNewPhotos([]);
    }
  }, [open, currentMessage, currentImages]);

  const handleRemoveExistingImage = (imageId: string) => {
    setImagesToKeep((prev) => prev.filter((img) => img.id !== imageId));
  };

  const handleSave = async () => {
    try {
      await updateAchievementPost({
        achievementPostId,
        message: message.trim() || undefined,
        imageIdsToKeep: imagesToKeep.map((img) => img.id),
        newPhotos: newPhotos.length > 0 ? newPhotos : undefined,
      });
      onClose();
    } catch {
      // Error is handled in the context
    }
  };

  const totalImages = imagesToKeep.length + newPhotos.length;
  const canAddMorePhotos = totalImages < 1;

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
              className="min-h-[80px] resize-none"
              disabled={isUpdatingAchievementPost}
            />
          </div>

          {/* Existing photo */}
          {imagesToKeep.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Current Photo
              </label>
              <div className="flex flex-wrap gap-2">
                {imagesToKeep.map((image) => (
                  <div key={image.id} className="relative">
                    <img
                      src={image.url}
                      alt="Achievement"
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingImage(image.id)}
                      disabled={isUpdatingAchievementPost}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New photo preview */}
          {newPhotos.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                New Photo
              </label>
              <div className="flex flex-wrap gap-2">
                {newPhotos.map((file, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="New photo"
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setNewPhotos(prev => prev.filter((_, i) => i !== index))}
                      disabled={isUpdatingAchievementPost}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new photo */}
          {canAddMorePhotos && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                {imagesToKeep.length > 0 ? "Replace Photo" : "Photo"}
              </label>
              <MultiPhotoUploader
                onFilesChange={setNewPhotos}
                maxFiles={1}
                disabled={isUpdatingAchievementPost}
              />
            </div>
          )}
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
