import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActivities } from "@/contexts/activities";
import { useCurrentUser } from "@/contexts/users";
import { Activity } from "@tsw/prisma";
import { Loader2, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";
import SteppedColorPicker from "./SteppedColorPicker";
import { EmojiInput } from "./ui/EmojiInput";
import { Separator } from "./ui/separator";
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
  const { currentUser } = useCurrentUser();
  const {
    upsertActivity,
    deleteActivity,
    isUpsertingActivity,
    isDeletingActivity,
  } = useActivities();

  const [colorHex, setColorHex] = useState(activity?.colorHex || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activity) {
      setTitle(activity.title || "");
      setMeasure(activity.measure || "");
      setEmoji(activity.emoji || "");
      // setPrivacySetting(
      //   activity.privacy_settings ||
      //     userData?.defaultActivityVisibility ||
      //     "public"
      // );
      setColorHex(activity.colorHex || "");
    }
  }, [activity]);

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

    upsertActivity({
      ...activity,
      emoji,
      title: title.trim(),
      measure: measure.trim(),
      colorHex: colorHex === "" ? null : colorHex,
    });
  };

  const handleDelete = async () => {
    if (!activity) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    deleteActivity({ id: activity!.id });
    onClose();
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
              loading={isUpsertingActivity}
            >
              Save Activity
            </Button>
            {activity && (
              <Button
                onClick={handleDelete}
                variant="outline"
                className="w-full mt-4 text-red-500"
                disabled={isDeletingActivity}
              >
                {isDeletingActivity ? (
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

      <ConfirmDialogOrPopover
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
