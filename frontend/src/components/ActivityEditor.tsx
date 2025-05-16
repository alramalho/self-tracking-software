import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Check } from "lucide-react";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import {
  Activity,
  useUserPlan,
  VisibilityType,
} from "@/contexts/UserPlanContext";
import ConfirmDialog from "./ConfirmDialog";
import { EmojiInput } from "./ui/EmojiInput";
import ActivityPrivacyDropdown from "./ActivityPrivacyDropdown";
import SteppedColorPicker from "./SteppedColorPicker";
import { Separator } from "./ui/separator";

export function toReadablePrivacySetting(privacySetting: VisibilityType) {
  switch (privacySetting) {
    case "public":
      return "Everyone";
    case "private":
      return "Only me";
    case "friends":
      return "Only Friends";
  }
}

interface ActivityEditorProps {
  onClose: () => void;
  activity?: Activity;
  open: boolean;
}

const ActivityEditor: React.FC<ActivityEditorProps> = ({
  onClose,
  activity,
  open,
}) => {
  const [title, setTitle] = useState(activity?.title || "");
  const [measure, setMeasure] = useState(activity?.measure || "");
  const [emoji, setEmoji] = useState(activity?.emoji || "");
  const { useCurrentUserDataQuery, updateLocalUserData, syncCurrentUserWithProfile } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const [privacySetting, setPrivacySetting] = useState<VisibilityType>(
    activity?.privacy_settings ||
      userData?.user?.default_activity_visibility ||
      "public"
  );
  const [colorHex, setColorHex] = useState(activity?.color_hex || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const api = useApiWithAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activity) {
      setTitle(activity.title || "");
      setMeasure(activity.measure || "");
      setEmoji(activity.emoji || "");
      setPrivacySetting(
        activity.privacy_settings ||
          userData?.user?.default_activity_visibility ||
          "public"
      );
      setColorHex(activity.color_hex || "");
    }
  }, [activity, userData?.user?.default_activity_visibility]);

  useEffect(() => {
    console.log({ activity });
  }, [activity]);

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
        title: title.trim(),
        measure: measure.trim(),
        privacy_settings: privacySetting,
        color_hex: colorHex === "" ? null : colorHex,
      });
      
      const savedActivity = response.data as Activity;
      updateLocalUserData((currentData) => {
        if (!activity) {
          return {
            ...currentData,
            activities: [...currentData.activities, savedActivity],
          };
        }
        
        return {
          ...currentData,
          activities: currentData.activities.map((act: Activity) => 
            act.id === savedActivity.id ? savedActivity : act
          ),
        };
      });

      syncCurrentUserWithProfile();
      
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
      
      updateLocalUserData((currentData) => {
        return {
          ...currentData,
          activities: currentData.activities.filter((act: Activity) => act.id !== activity!.id),
        };
      });
      
      syncCurrentUserWithProfile();
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
      <AppleLikePopover open={open} onClose={onClose}>
        <div data-testid="activity-editor" className="h-fit">
          <h2 className="text-2xl font-bold mb-4">
            {activity ? "Edit Activity" : "Add New Activity"}
          </h2>
          <div className="flex flex-col justify-between h-full">
            <div className="flex flex-col gap-4">
              {/* <div className="flex flex-row justify-between items-center gap-2">
                <span className="text-md h-fit">
                  Who can see this activity?
                </span>
                <ActivityPrivacyDropdown
                  value={privacySetting}
                  onChange={setPrivacySetting}
                />
              </div> */}
              <EmojiInput
                value={emoji}
                onChange={(emoji) => setEmoji(emoji)}
                placeholder="Enter an emoji"
              />
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
              <SteppedColorPicker value={colorHex} onChange={setColorHex} />

              <Separator className="my-4" />
            </div>
            <Button
              onClick={handleSave}
              className="w-full py-5"
              loading={isSaving}
            >
              Save Activity
            </Button>
            {activity && (
              <Button
                onClick={handleDelete}
                variant="outline"
                className="w-full mt-4 text-red-500"
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
