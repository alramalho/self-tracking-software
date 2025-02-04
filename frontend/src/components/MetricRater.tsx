import { Button } from "@/components/ui/button";
import { useApiWithAuth } from "@/api";
import { useState } from "react";
import toast from "react-hot-toast";

const ratingColors = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-lime-500",
  5: "text-green-500",
} as const;

interface MetricRaterProps {
  metricId: string;
  metricTitle: string;
  metricEmoji: string;
  onRatingSubmitted?: () => void;
  className?: string;
}

export function MetricRater({ 
  metricId, 
  metricTitle, 
  metricEmoji,
  onRatingSubmitted,
  className = ""
}: MetricRaterProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const api = useApiWithAuth();

  const handleSubmitRating = async () => {
    if (!selectedRating) return;

    try {
      setIsLoading(true);
      await api.post("/log-metric", {
        metric_id: metricId,
        rating: selectedRating,
      });

      toast.success("Rating submitted successfully");
      onRatingSubmitted?.();
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error("Failed to submit rating");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-8 ${className}`}>
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">
          Rate your {metricTitle}
        </h1>
        <p className="text-md text-muted-foreground">
          How would you rate your {metricTitle.toLowerCase()} today?
        </p>
        <div className="text-4xl">{metricEmoji}</div>
      </div>

      <div className="flex justify-center gap-2 my-12">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            onClick={() => setSelectedRating(rating)}
            className={`
              w-16 h-16 rounded-xl text-2xl font-bold
              transition-all duration-200
              border-2 bg-background
              ${ratingColors[rating as keyof typeof ratingColors]}
              ${
                selectedRating === rating
                  ? "ring-2 ring-offset-2 ring-primary scale-110 border-primary"
                  : "border-muted-foreground/20 hover:border-primary hover:scale-105"
              }
            `}
          >
            {rating}
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          className="w-full max-w-sm"
          disabled={!selectedRating || isLoading}
          onClick={handleSubmitRating}
        >
          {isLoading ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  );
} 