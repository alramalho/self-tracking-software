import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { format } from "date-fns";

interface ActivityEntry {
  id: string;
  quantity: number;
  date: string;
  activity_id: string;
}

interface ActivityEntryEditorProps {
  activityEntry: ActivityEntry;
  onClose: () => void;
}

const ActivityEntryEditor: React.FC<ActivityEntryEditorProps> = ({
  activityEntry,
  onClose,
}) => {
  const [quantity, setQuantity] = useState(activityEntry.quantity.toString());
  const [date, setDate] = useState(
    format(new Date(activityEntry.date), "yyyy-MM-dd'T'HH:mm")
  );
  const [isSaving, setIsSaving] = useState(false);
  const { fetchUserData, setUserData, userData } = useUserPlan();
  const api = useApiWithAuth();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put(`/activity-entries/${activityEntry.id}`, {
        quantity: Number(quantity),
        date: new Date(date).toISOString(),
      });

      setUserData("me", {
        ...userData["me"],
        activityEntries: userData["me"]?.activityEntries.map((e) =>
          e.id === activityEntry.id
            ? {
                ...e,
                quantity: Number(quantity),
                date: new Date(date).toISOString(),
              }
            : e
        ),
      });

      await fetchUserData();
      toast.success("Activity entry updated successfully!");
      onClose();
    } catch (error) {
      console.error("Error updating activity entry:", error);
      toast.error("Failed to update activity entry");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppleLikePopover onClose={onClose}>
      <h2 className="text-2xl font-bold mb-4">Edit Activity Entry</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Quantity</label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <Input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Button onClick={handleSave} className="w-full" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </AppleLikePopover>
  );
};

export default ActivityEntryEditor;
