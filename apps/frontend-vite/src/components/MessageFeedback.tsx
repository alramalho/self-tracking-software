import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppleLikePopover from "@/components/AppleLikePopover";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useState } from "react";

interface MessageFeedbackProps {
  messageId: string;
  existingFeedback?: {
    feedbackType: "POSITIVE" | "NEGATIVE";
    feedbackReasons: string[];
    additionalComments: string | null;
  } | null;
  onSubmitFeedback: (data: {
    messageId: string;
    feedbackType: "POSITIVE" | "NEGATIVE";
    feedbackReasons?: string[];
    additionalComments?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

const NEGATIVE_FEEDBACK_OPTIONS = [
  "Don't like the personality",
  "Don't like the style",
  "Hallucinated",
  "Unsafe or problematic",
  "Biased",
];

export const MessageFeedback: React.FC<MessageFeedbackProps> = ({
  messageId,
  existingFeedback,
  onSubmitFeedback,
  isSubmitting,
}) => {
  const [showNegativeFeedbackPopup, setShowNegativeFeedbackPopup] =
    useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [additionalComments, setAdditionalComments] = useState("");

  const handlePositiveFeedback = async () => {
    await onSubmitFeedback({
      messageId,
      feedbackType: "POSITIVE",
    });
  };

  const handleNegativeFeedback = () => {
    setShowNegativeFeedbackPopup(true);
  };

  const handleSubmitNegativeFeedback = async () => {
    await onSubmitFeedback({
      messageId,
      feedbackType: "NEGATIVE",
      feedbackReasons: selectedReasons,
      additionalComments: additionalComments.trim() || undefined,
    });
    setShowNegativeFeedbackPopup(false);
    setSelectedReasons([]);
    setAdditionalComments("");
  };

  const handleCancelNegativeFeedback = () => {
    setShowNegativeFeedbackPopup(false);
    setSelectedReasons([]);
    setAdditionalComments("");
  };

  const toggleReason = (reason: string) => {
    if (selectedReasons.includes(reason)) {
      setSelectedReasons(selectedReasons.filter((r) => r !== reason));
    } else {
      setSelectedReasons([...selectedReasons, reason]);
    }
  };

  const hasPositiveFeedback = existingFeedback?.feedbackType === "POSITIVE";
  const hasNegativeFeedback = existingFeedback?.feedbackType === "NEGATIVE";

  return (
    <>
      <div className="flex gap-1 items-center mt-1">
        <button
          onClick={handlePositiveFeedback}
          disabled={isSubmitting || !!existingFeedback}
          className={`p-1.5 rounded-md transition-colors ${
            hasPositiveFeedback
              ? "bg-muted text-foreground"
              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="Good response"
          title="Good response"
        >
          <ThumbsUp size={18} />
        </button>
        <button
          onClick={handleNegativeFeedback}
          disabled={isSubmitting || !!existingFeedback}
          className={`p-1.5 rounded-md transition-colors ${
            hasNegativeFeedback
              ? "bg-muted text-foreground"
              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="Bad response"
          title="Bad response"
        >
          <ThumbsDown size={18} />
        </button>
      </div>

      <AppleLikePopover
        open={showNegativeFeedbackPopup}
        onClose={handleCancelNegativeFeedback}
        title="Provide feedback"
      >
        <div className="space-y-4 pt-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">
              What was wrong with this response?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select all that apply
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {NEGATIVE_FEEDBACK_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => toggleReason(option)}
                className={`px-3 py-2 text-sm rounded-full border transition-colors ${
                  selectedReasons.includes(option)
                    ? "bg-muted border-foreground/20"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div>
            <label
              htmlFor="additional-feedback"
              className="text-sm text-muted-foreground block mb-2"
            >
              Additional feedback (optional)
            </label>
            <Input
              id="additional-feedback"
              value={additionalComments}
              onChange={(e) => setAdditionalComments(e.target.value)}
              placeholder="Feel free to add specific details..."
              className="w-full"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={handleCancelNegativeFeedback}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitNegativeFeedback}
              disabled={isSubmitting || selectedReasons.length === 0}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>
      </AppleLikePopover>
    </>
  );
};
