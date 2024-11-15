import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import { Activity, useUserPlan } from "@/contexts/UserPlanContext";

interface ActivityEditorProps {
  onClose: () => void;
  onSave: (activity: Activity) => void;
  activity?: Activity;
}

const ActivityEditor: React.FC<ActivityEditorProps> = ({
  onClose,
  onSave,
  activity,
}) => {
  const [title, setTitle] = useState(activity?.title || "");
  const [measure, setMeasure] = useState(activity?.measure || "");
  const [emoji, setEmoji] = useState(activity?.emoji || "");
  const [isSaving, setIsSaving] = useState(false);
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const api = useApiWithAuth();

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
      userDataQuery.refetch();

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

  return (
    <AppleLikePopover onClose={onClose}>
      <h2 className="text-2xl font-bold mb-4">
        {activity ? "Edit Activity" : "Add New Activity"}
      </h2>
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          {emoji ? (
            <div className="text-4xl w-16 h-16 flex items-center justify-center border rounded-lg">
              {emoji}
            </div>
          ) : (
            <div
              className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100"
              onClick={() => document.getElementById("emoji-input")?.focus()}
            >
              <Plus className="h-6 w-6 text-gray-400" />
            </div>
          )}
          <Input
            id="emoji-input"
            placeholder="Emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="text-2xl"
          />
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
        <Button onClick={handleSave} className="w-full" loading={isSaving}>
          Save Activity
        </Button>
      </div>
    </AppleLikePopover>
  );
};

export default ActivityEditor;
