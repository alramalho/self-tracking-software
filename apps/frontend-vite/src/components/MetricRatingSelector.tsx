import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const ratingColors = {
  1: "text-red-500",
  2: "text-orange-500", 
  3: "text-yellow-500",
  4: "text-lime-500",
  5: "text-green-500",
} as const;

interface MetricRatingSelectorProps {
  onRatingSelect: (rating: number) => void;
  disabled?: boolean;
  initialRating?: number;
  loading?: boolean;
}

export const MetricRatingSelector: React.FC<MetricRatingSelectorProps> = ({
  onRatingSelect,
  disabled = false,
  initialRating,
  loading = false,
}) => {
  const [selectedRating, setSelectedRating] = useState<number | null>(initialRating || null);

  // Update selectedRating when initialRating changes
  useEffect(() => {
    setSelectedRating(initialRating || null);
  }, [initialRating]);

  const handleRatingClick = (rating: number) => {
    setSelectedRating(rating);
    onRatingSelect(rating);
  };


  return (
    <div className="flex gap-1 w-full">
      {[1, 2, 3, 4, 5].map((rating) => {
        const shouldLoad = loading && selectedRating === rating;
        return(
        <Button
          key={rating}
          variant={"outline"}
          size="sm"
          onClick={() => handleRatingClick(rating)}
          disabled={disabled}
          className={`aspect-square p-4 text-md font-medium w-full ${
            selectedRating === rating
              ? "bg-muted text-foreground border-foreground"
              : `hover:bg-muted ${ratingColors[rating as keyof typeof ratingColors]}`
          }`}
        >
          {shouldLoad && <Loader2 className="w-4 h-4 animate-spin" />}
          {!shouldLoad && rating}
        </Button>
      )})}
    </div>
  );
}; 