import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActivities } from "@/contexts/activities/useActivities";
import { type Activity } from "@tsw/prisma";
import { Loader2, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";
import { EmojiInput } from "./ui/emoji-input";
import { Separator } from "./ui/separator";
import SteppedColorPicker from "./SteppedColorPicker";

type MeasureConversionOperator = "multiply" | "divide";

const PREVIEW_QUANTITY = 60;

function formatPreviewMeasure(measure: string, quantity: number) {
  const trimmed = measure.trim();
  if (quantity === 1 && trimmed.endsWith("s")) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
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
  const {
    upsertActivity,
    deleteActivity,
    isUpsertingActivity,
    isDeletingActivity,
  } = useActivities();

  const [colorHex, setColorHex] = useState(activity?.colorHex || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMeasureConfirm, setShowMeasureConfirm] = useState(false);
  const [conversionOperator, setConversionOperator] =
    useState<MeasureConversionOperator>("divide");
  const [conversionFactor, setConversionFactor] = useState("1");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activity) {
      setTitle(activity.title || "");
      setMeasure(activity.measure || "");
      setEmoji(activity.emoji || "");
      setColorHex(activity.colorHex || "");
      setShowMeasureConfirm(false);
      setConversionOperator("divide");
      setConversionFactor("1");
    }
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

  const oldMeasure = activity?.measure?.trim() || "";
  const newMeasure = measure.trim();
  const isMeasureChanged = !!activity && oldMeasure !== newMeasure;
  const conversionFactorNumber = Number(conversionFactor);
  const isValidConversionFactor =
    Number.isInteger(conversionFactorNumber) && conversionFactorNumber > 0;
  const previewConvertedQuantity =
    conversionOperator === "multiply"
      ? PREVIEW_QUANTITY * conversionFactorNumber
      : PREVIEW_QUANTITY / conversionFactorNumber;

  const saveActivity = async (
    measureConversion?: {
      operator: MeasureConversionOperator;
      factor: number;
    }
  ) => {
    if (!title || !measure || !emoji) {
      toast.error("Title, measure, and emoji are required.");
      return;
    }

    await upsertActivity({
      activity: {
        ...activity,
        emoji,
        title: title.trim(),
        measure: newMeasure,
        colorHex: colorHex === "" ? null : colorHex,
      },
      measureConversion,
    });
    onClose?.();
  };

  const handleSave = async () => {
    if (isMeasureChanged) {
      setShowMeasureConfirm(true);
      return;
    }

    await saveActivity();
  };

  const confirmMeasureChange = async () => {
    if (!isValidConversionFactor) {
      toast.error("Multiplier must be a positive whole number.");
      return;
    }

    await saveActivity({
      operator: conversionOperator,
      factor: conversionFactorNumber,
    });
    setShowMeasureConfirm(false);
  };

  const handleDelete = async () => {
    if (!activity) return;
    setShowDeleteConfirm(true);
  };


  const confirmDelete = async () => {
    await deleteActivity({ id: activity!.id });
    setShowDeleteConfirm(false);
    onClose?.();
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
              <Input
                placeholder="Measure (e.g., minutes, times)"
                value={measure}
                onChange={(e) => setMeasure(e.target.value)}
              />
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
        description={<>Are you sure you want to delete this activity? <strong>This will permanently delete all entries, reactions, and comments associated with it.</strong> This action cannot be undone.</>}
        confirmText="Delete"
        variant="destructive"
      />

      <ConfirmDialogOrPopover
        isOpen={showMeasureConfirm}
        onClose={() => setShowMeasureConfirm(false)}
        onConfirm={confirmMeasureChange}
        title="Change Activity Measure"
        description={
          <div className="space-y-4 text-left">
            <p>
              This changes how existing logs and planned sessions for this
              activity are measured. Pick how old quantities should convert.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 text-sm font-medium text-foreground">
                Conversion
              </div>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{oldMeasure}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-12 shrink-0 px-0 text-lg"
                  onClick={() =>
                    setConversionOperator((operator) =>
                      operator === "divide" ? "multiply" : "divide"
                    )
                  }
                >
                  {conversionOperator === "divide" ? "÷" : "×"}
                </Button>
                <Input
                  className="h-9 w-20 shrink-0 text-center"
                  inputMode="numeric"
                  value={conversionFactor}
                  onChange={(event) => setConversionFactor(event.target.value)}
                />
                <span className="min-w-0 flex-1 truncate">{newMeasure}</span>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {Number.isFinite(previewConvertedQuantity) &&
                isValidConversionFactor ? (
                  <>
                    {PREVIEW_QUANTITY}{" "}
                    {formatPreviewMeasure(oldMeasure, PREVIEW_QUANTITY)} ={" "}
                    {previewConvertedQuantity}{" "}
                    {formatPreviewMeasure(
                      newMeasure,
                      previewConvertedQuantity
                    )}
                  </>
                ) : (
                  "Enter a positive whole number to preview the conversion."
                )}
              </div>
            </div>
            {isValidConversionFactor &&
              !Number.isInteger(previewConvertedQuantity) && (
                <p className="text-sm text-red-500">
                  This conversion can create fractional quantities. Existing
                  activity quantities are whole numbers today, so the server may
                  reject it if any saved log or session would become fractional.
                </p>
              )}
          </div>
        }
        confirmText="Change Measure"
        isConfirming={isUpsertingActivity}
      />
    </>
  );
};

export default ActivityEditor;
