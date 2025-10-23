import { useThemeColors } from "@/hooks/useThemeColors";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { useState } from "react";

interface MetricSuggestionProps {
  messageId: string;
  metricId: string;
  metricTitle: string;
  rating: number;
  displayText: string;
  emoji?: string;
  status?: "accepted" | "rejected" | null;
  onAccept: (messageId: string, metricId: string, rating: number) => Promise<void>;
  onReject: (messageId: string) => Promise<void>;
}

export function MetricSuggestion({
  messageId,
  metricId,
  metricTitle,
  rating,
  displayText,
  emoji,
  status,
  onAccept,
  onReject,
}: MetricSuggestionProps) {
  const themeColors = useThemeColors();
  const [isAccepted, setIsAccepted] = useState(status === "accepted");
  const [isRejected, setIsRejected] = useState(status === "rejected");
  const [isLoading, setIsLoading] = useState(false);
  const [showPopover, setShowPopover] = useState(false);

  const getInterpretation = (metricTitle: string, rating: number): string => {
    const lowerTitle = metricTitle.toLowerCase();

    // Generate interpretation based on rating and metric type
    const getRatingAdjective = () => {
      if (rating >= 4) return "really";
      if (rating === 3) return "somewhat";
      return "not very";
    };

    const getRatingIntensity = () => {
      if (rating === 5) return "very";
      if (rating === 4) return "quite";
      if (rating === 3) return "moderately";
      if (rating === 2) return "a bit";
      return "not";
    };

    // Common metric interpretations
    if (lowerTitle.includes("happy") || lowerTitle.includes("happiness")) {
      if (rating >= 4) return `Oli thinks you felt ${getRatingAdjective()} happy today`;
      if (rating === 3) return "Oli thinks you felt okay today";
      return `Oli thinks you didn't feel ${getRatingIntensity()} happy today`;
    }

    if (lowerTitle.includes("energy") || lowerTitle.includes("energetic")) {
      if (rating >= 4) return `Oli thinks you felt ${getRatingAdjective()} energetic today`;
      if (rating === 3) return "Oli thinks you had moderate energy today";
      return `Oli thinks you didn't feel ${getRatingIntensity()} energetic today`;
    }

    if (lowerTitle.includes("stress")) {
      if (rating >= 4) return `Oli thinks you felt ${getRatingAdjective()} stressed today`;
      if (rating === 3) return "Oli thinks you felt moderately stressed today";
      return `Oli thinks you felt ${getRatingIntensity()} stressed today`;
    }

    if (lowerTitle.includes("motivation") || lowerTitle.includes("motivated")) {
      if (rating >= 4) return `Oli thinks you felt ${getRatingAdjective()} motivated today`;
      if (rating === 3) return "Oli thinks you felt moderately motivated today";
      return `Oli thinks you didn't feel ${getRatingIntensity()} motivated today`;
    }

    if (lowerTitle.includes("focus") || lowerTitle.includes("concentrated")) {
      if (rating >= 4) return `Oli thinks you were ${getRatingAdjective()} focused today`;
      if (rating === 3) return "Oli thinks you had moderate focus today";
      return `Oli thinks you weren't ${getRatingIntensity()} focused today`;
    }

    // Generic fallback
    if (rating >= 4) return `Oli thinks your ${lowerTitle} was ${getRatingIntensity()} high today`;
    if (rating === 3) return `Oli thinks your ${lowerTitle} was moderate today`;
    return `Oli thinks your ${lowerTitle} was ${getRatingIntensity()} high today`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPopover(true);
  };

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await onAccept(messageId, metricId, rating);
      setIsAccepted(true);
      setShowPopover(false);
    } catch (error) {
      console.error("Failed to accept metric suggestion:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await onReject(messageId);
      setIsRejected(true);
      setShowPopover(false);
    } catch (error) {
      console.error("Failed to reject metric suggestion:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isRejected) {
    return null;
  }

  if (isAccepted) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-md px-2 py-0.5 text-foreground/70 ${themeColors.fadedBg} opacity-60`}
      >
        {emoji && <span className="text-base leading-none">{emoji}</span>}
        <span className="line-through">{displayText}</span>
        <Check size={14} className="text-green-500 flex-shrink-0" />
      </span>
    );
  }

  return (
    <>
      <span
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 font-medium rounded-md px-2 py-0.5 transition-all text-foreground/90 ${themeColors.fadedBg} cursor-pointer hover:opacity-80`}
      >
        {emoji && <span className="text-base leading-none">{emoji}</span>}
        <span>{displayText}</span>
        <span className="text-xs text-muted-foreground ml-1">({rating}/5)</span>
        <div className="flex items-center gap-0.5 ml-1">
          <Check size={14} className="text-green-600 dark:text-green-400" />
          <X size={14} className="text-red-600 dark:text-red-400" />
        </div>
      </span>

      {/* Metric Suggestion Popover */}
      <AppleLikePopover
        open={showPopover}
        onClose={() => setShowPopover(false)}
        title="Metric Suggestion"
      >
        <div className="space-y-4 pt-8">
          <div className="text-center">
            <div className="text-5xl mb-3">{emoji}</div>
            <h2 className="text-xl font-semibold mb-2">
              Log {rating}/5 for {metricTitle}?
            </h2>
            <p className="text-sm text-muted-foreground italic">
              {getInterpretation(metricTitle, rating)}
            </p>
          </div>
          <div className="flex flex-row gap-2 justify-center items-center ">
            <Button
              variant="outline"
              className="w-1/2 h-10"
              onClick={handleReject}
              disabled={isLoading}
            >
              Reject
            </Button>
            <Button
              className={`w-1/2 h-10 ${themeColors.button.solid}`}
              onClick={handleAccept}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Logging...
                </>
              ) : (
                <>
                  {emoji && <span className="mr-2">{emoji}</span>}
                  Accept
                </>
              )}
            </Button>
          </div>
        </div>
      </AppleLikePopover>
    </>
  );
}
