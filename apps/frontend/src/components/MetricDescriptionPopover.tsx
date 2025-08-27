import React from "react";
import AppleLikePopover from "./AppleLikePopover";
import { TextAreaWithVoice } from "./ui/TextAreaWithVoice";
import { Button } from "./ui/button";

interface MetricDescriptionPopoverProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (description: string) => void;
  metricTitle: string;
}

export function MetricDescriptionPopover({
  open,
  onClose,
  onSubmit,
  metricTitle,
}: MetricDescriptionPopoverProps) {
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(description);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Why?</h2>
          <p className="text-gray-500">
            Help yourself understand what influenced your {metricTitle.toLowerCase()} today
          </p>
        </div>

        <TextAreaWithVoice
          value={description}
          onChange={setDescription}
          placeholder={`What made your ${metricTitle.toLowerCase()} like this today?`}
          disabled={isSubmitting}
        />

        <Button
          onClick={handleSubmit}
          disabled={!description.trim() || isSubmitting}
          className="w-full"
        >
          Save
        </Button>
      </div>
    </AppleLikePopover>
  );
} 