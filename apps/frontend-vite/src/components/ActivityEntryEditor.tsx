import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActivities } from "@/contexts/activities/useActivities";
import { toMidnightUTCDate } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import React, { useState } from "react";
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
  open: boolean;
}

const ActivityEntryEditor: React.FC<ActivityEntryEditorProps> = ({
  activityEntry,
  onClose,
  open,
}) => {
  const [quantity, setQuantity] = useState(activityEntry.quantity.toString());
  const [date, setDate] = useState(
    format(new Date(activityEntry.date), "yyyy-MM-dd")
  );
  const [description, setDescription] = useState(
    activityEntry.description || ""
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const {
    upsertActivityEntry,
    isUpsertingActivityEntry,
    deleteActivityEntry,
    isDeletingActivityEntry,
  } = useActivities();

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <h2 className="text-2xl font-bold mb-4">Edit Activity Entry</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Quantity</label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.floor(Number(e.target.value)).toString())
            }
            step="1"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <Input
            type="date"
            value={new Date(date).toISOString().split("T")[0]}
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
        <Button
          onClick={() => {
            upsertActivityEntry({
              entry: {
                id: activityEntry.id,
                quantity: Number(quantity),
                date: toMidnightUTCDate(new Date(date)),
                description,
              },
            });
            onClose?.();
          }}
          className="w-full"
          disabled={isUpsertingActivityEntry}
        >
          {isUpsertingActivityEntry ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          onClick={() => setShowDeleteConfirm(true)}
          variant="destructive"
          className="w-full"
          disabled={isUpsertingActivityEntry || isDeletingActivityEntry}
        >
          {isDeletingActivityEntry ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4 mr-2" />
          )}
          Delete Activity
        </Button>
        <ConfirmDialogOrPopover
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            deleteActivityEntry({ id: activityEntry.id });
            setShowDeleteConfirm(false);
            onClose?.();
          }}
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
