import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import { Activity, useUserPlan } from "@/contexts/UserPlanContext";
import ConfirmDialog from "./ConfirmDialog";
import EmojiPicker from "emoji-picker-react";

interface ActivityEditorProps {
  onClose: () => void;
  onSave: (activity: Activity) => void;
  activity?: Activity;
  open: boolean;
}

const ActivityEditor: React.FC<ActivityEditorProps> = ({
  onClose,
  onSave,
  activity,
  open,
}) => {
  const [title, setTitle] = useState(activity?.title || "");
  const [measure, setMeasure] = useState(activity?.measure || "");
  const [emoji, setEmoji] = useState(activity?.emoji || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { useUserDataQuery, refetchUserData } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const api = useApiWithAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        emojiButtonRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleSave = async () => {
    if (!title || !measure || !emoji) {
      toast.error("Title, measure, and emoji are required.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.post("/upsert-activity", {
        ...activity,
        emoji,
        title,
        measure,
      });
      refetchUserData();

      const savedActivity = response.data;
      onSave(savedActivity);
      toast.success("Activity saved successfully!");
      onClose();
    } catch (error) {
      console.error("Error saving activity:", error);
      toast.error("Failed to save activity. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activity) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      await api.delete(`/activities/${activity!.id}`);
      userDataQuery.refetch();
      toast.success("Activity deleted successfully!");
      onClose();
    } catch (error: any) {
      console.error("Error deleting activity:", error);
      if (error.response?.status === 400) {
        toast.error(`Delete failed: ${error.response.data.detail}`);
      } else {
        toast.error("Failed to delete activity. Please try again.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const onEmojiClick = (emojiData: any) => {
    setEmoji(emojiData.emoji);
    setShowEmojiPicker(false);
  };

  return (
    <>
      <AppleLikePopover open={open} className="z-[70]" onClose={onClose}>
        <h2 className="text-2xl font-bold mb-4">
          {activity ? "Edit Activity" : "Add New Activity"}
        </h2>
        <div className="flex flex-col justify-between h-full">
          <div className="flex flex-col gap-4">
            <div className="flex items-center space-x-4 relative">
              {emoji ? (
                <div
                  ref={emojiButtonRef}
                  className="text-4xl w-16 h-16 flex items-center justify-center border rounded-lg cursor-pointer hover:bg-gray-100"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  {emoji}
                </div>
              ) : (
                <div
                  data-testid="emoji-picker-button"
                  ref={emojiButtonRef}
                  className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Plus className="h-6 w-6 text-gray-400" />
                </div>
              )}
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute top-[10px] left-[-30px] mt-2"
                  style={{ zIndex: 1000 }}
                >
                  <EmojiPicker onEmojiClick={onEmojiClick} />
                </div>
              )}
            </div>
            <Input
              placeholder="Activity Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {!activity && (
              <Input
                placeholder="Measure (e.g., minutes, times)"
                value={measure}
                onChange={(e) => setMeasure(e.target.value)}
              />
            )}
            {activity && (
              <Button
                onClick={handleDelete}
                variant="destructive"
                className="w-full"
                disabled={isSaving}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete Activity
              </Button>
            )}
          </div>
          <Button
            onClick={handleSave}
            className="w-full py-5 mt-8"
            loading={isSaving}
          >
            Save Activity
          </Button>
        </div>
      </AppleLikePopover>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Activity"
        description="Are you sure you want to delete this activity? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
};

export default ActivityEditor;
