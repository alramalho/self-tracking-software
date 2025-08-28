import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";

interface ActivityEntry {
  id: string;
  quantity: number;
  date: Date;
  activityId: string;
  description?: string;
}

interface ActivityEntryEditorProps {
  activityEntry: ActivityEntry;
  onClose: () => void;
  onDelete: () => void;
  open: boolean;
}

const ActivityEntryEditor: React.FC<ActivityEntryEditorProps> = ({
  activityEntry,
  onClose,
  onDelete,
  open,
}) => {
  const [quantity, setQuantity] = useState(activityEntry.quantity.toString());
  const [date, setDate] = useState(
    format(new Date(activityEntry.date), "yyyy-MM-dd'T'HH:mm")
  );
  const [description, setDescription] = useState(activityEntry.description || "");
  const [isSaving, setIsSaving] = useState(false);
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const api = useApiWithAuth();


  const handleDelete = async () => {
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    try {
      await api.delete(`/activities/activity-entries/${activityEntry.id}`);
      onDelete();
      toast.success("Activity entry deleted successfully!");
    } catch (error) {
      console.error("Error deleting activity entry:", error);
      toast.error("Failed to delete activity entry");
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put(`/activities/activity-entries/${activityEntry.id}`, {
        quantity: Number(quantity),
        date: new Date(date).toISOString(),
        description,
      });
      
      await currentUserDataQuery.refetch();
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
    <AppleLikePopover open={open} onClose={onClose}>
      <h2 className="text-2xl font-bold mb-4">Edit Activity Entry</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Quantity</label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.floor(Number(e.target.value)).toString())}
            step="1"
            min="0"
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
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            className="min-h-[80px]"
          />
        </div>
        <Button onClick={handleSave} className="w-full" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          onClick={() => setShowDeleteConfirm(true)}
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
        <ConfirmDialogOrPopover
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Confirm Delete"
          description="Are you sure you want to delete this activity entry?"
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
        />
      </div>
    </AppleLikePopover>
  );
};

export default ActivityEntryEditor;
