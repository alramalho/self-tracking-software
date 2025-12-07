import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { useActivities } from "@/contexts/activities/useActivities";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import React, { useState } from "react";
import Picker from "react-mobile-picker";
import AppleLikePopover from "./AppleLikePopover";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";

interface ActivityEntry {
  id: string;
  quantity: number;
  datetime: Date;
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
  const entryDate = new Date(activityEntry.datetime);

  const [selectedDate, setSelectedDate] = useState<Date>(entryDate);
  const [quantity, setQuantity] = useState<number>(activityEntry.quantity);
  const [time, setTime] = useState({
    hour: entryDate.getHours().toString().padStart(2, "0"),
    minute: entryDate.getMinutes().toString().padStart(2, "0"),
  });
  const [description, setDescription] = useState(activityEntry.description || "");
  const [isTimePickerExpanded, setIsTimePickerExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    upsertActivityEntry,
    isUpsertingActivityEntry,
    deleteActivityEntry,
    isDeletingActivityEntry,
    activities,
  } = useActivities();

  const activity = activities.find((a) => a.id === activityEntry.activityId);
  const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Generate hours and minutes options
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

  const handleQuantityChange = (amount: number) => {
    setQuantity(Math.max(0, quantity + amount));
  };

  const formatTimeReadable = (hour: string, minute: string) => {
    const hourNum = parseInt(hour);
    const minuteNum = parseInt(minute);

    if (minuteNum === 0) {
      return `at ${hourNum} o'clock`;
    }
    return `at ${hourNum}:${minute}`;
  };

  const handleSave = () => {
    // Combine selected date with selected time
    const datetime = new Date(selectedDate);
    datetime.setHours(parseInt(time.hour), parseInt(time.minute), 0, 0);

    upsertActivityEntry({
      entry: {
        id: activityEntry.id,
        quantity,
        datetime,
        description,
      },
    });
    onClose?.();
  };

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="space-y-6 p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Edit Entry</h2>
          {activity && (
            <div className="text-4xl mb-4">{activity.emoji}</div>
          )}
          <p className="text-xs font-normal text-center my-4">
            <span className="italic">📍 {currentTimezone}</span>
          </p>
        </div>

        <div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date: Date | undefined) => {
              if (date) {
                setSelectedDate(date);
              }
            }}
            className="rounded-md border mx-auto"
            disableFutureDates={true}
          />
        </div>

        <div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">
              {formatTimeReadable(time.hour, time.minute)}
            </span>
            <button
              type="button"
              onClick={() => setIsTimePickerExpanded(!isTimePickerExpanded)}
              className="p-1 hover:bg-accent rounded-md transition-colors"
              aria-label="Edit time"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          <AnimatePresence>
            {isTimePickerExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div
                  className="mt-4"
                  onTouchMove={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold mb-2 text-center">
                    Select Time
                  </h3>
                  <div className="max-w-xs mx-auto">
                    <Picker
                      value={time}
                      onChange={setTime}
                      wheelMode="normal"
                      height={180}
                    >
                      <Picker.Column name="hour">
                        {hours.map((hour) => (
                          <Picker.Item key={hour} value={hour}>
                            {hour}
                          </Picker.Item>
                        ))}
                      </Picker.Column>
                      <Picker.Column name="minute">
                        {minutes.map((minute) => (
                          <Picker.Item key={minute} value={minute}>
                            {minute}
                          </Picker.Item>
                        ))}
                      </Picker.Column>
                    </Picker>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4 text-center">
            how many <i>{activity?.measure || "units"}</i>?
          </h3>
          <div className="flex items-center justify-center space-x-4">
            <Button
              onClick={() => handleQuantityChange(-1)}
              variant="outline"
              size="icon"
              className="bg-card"
            >
              -
            </Button>
            <span className="text-2xl font-bold">{quantity}</span>
            <Button
              onClick={() => handleQuantityChange(1)}
              variant="outline"
              size="icon"
              className="bg-card"
            >
              +
            </Button>
          </div>
          <div className="mt-4 flex justify-center space-x-2">
            {[10, 30, 45, 60, 90].map((value) => (
              <Button
                key={value}
                onClick={() => setQuantity(value)}
                variant="secondary"
                className="bg-card"
                size="sm"
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-center">Description</h3>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            className="min-h-[80px]"
          />
        </div>

        <Button
          onClick={handleSave}
          className="w-full"
          disabled={quantity === 0 || !selectedDate || isUpsertingActivityEntry}
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
          Delete Entry
        </Button>

        <ConfirmDialogOrPopover
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            deleteActivityEntry({
              id: activityEntry.id,
              activityId: activityEntry.activityId,
            });
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
