import AppleLikePopover from "@/components/AppleLikePopover";
import { MetricIsland } from "@/components/MetricIsland";
import { Button } from "@/components/ui/button";
import { TextAreaWithVoice } from "@/components/ui/text-area-with-voice";
import { useActivities } from "@/contexts/activities/useActivities";
import { useMetrics } from "@/contexts/metrics";
import { todaysLocalDate } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { isToday } from "date-fns";
import { AlertTriangle, BarChartHorizontal, ChevronRight, Loader2 } from "lucide-react";
import React, { useState, useCallback } from "react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { motion } from "framer-motion";

interface MetricsLogPopoverProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  customIcon?: React.ReactNode;
  showActivityWarning?: boolean;
}

export const MetricsLogPopover: React.FC<MetricsLogPopoverProps> = ({
  open,
  onClose,
  title = "Log Your Metrics",
  description,
  customIcon,
  showActivityWarning = true,
}) => {
  const navigate = useNavigate();
  const { metrics, logMetrics, logTodaysNote } = useMetrics();
  const { activityEntries } = useActivities();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Local state for pending ratings - only submitted on close
  const [pendingRatings, setPendingRatings] = useState<Record<string, number>>({});
  // Local state for pending note - only submitted on close
  const [pendingNote, setPendingNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRatingChange = useCallback((metricId: string, rating: number) => {
    setPendingRatings(prev => ({ ...prev, [metricId]: rating }));
  }, []);

  const handleClose = useCallback(async () => {
    // Submit all pending ratings on close
    const ratingsToSubmit = Object.entries(pendingRatings);
    if (ratingsToSubmit.length > 0) {
      setIsSubmitting(true);
      try {
        await logMetrics(
          ratingsToSubmit.map(([metricId, rating]) => ({
            metricId,
            rating,
            date: todaysLocalDate(),
          }))
        );

        // Submit note after ratings (entries must exist first)
        if (pendingNote.trim()) {
          await logTodaysNote(pendingNote.trim());
        }
      } catch (error) {
        console.error("Failed to log metrics:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
    // Clear state and close
    setPendingRatings({});
    setPendingNote("");
    onClose();
  }, [pendingRatings, pendingNote, logMetrics, logTodaysNote, onClose]);

  // Check if any activities were logged today
  const hasActivitiesToday = activityEntries?.some((entry) =>
    isToday(entry.datetime)
  );

  // Check if all metrics have a pending rating (for showing note section)
  const allMetricsHavePendingRating = metrics?.length
    ? metrics.every((metric) => pendingRatings[metric.id] !== undefined)
    : false;

  return (
    <AppleLikePopover open={open} onClose={handleClose}>
      <div className="space-y-6 p-6">
        {/* Icon */}
        {customIcon ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="flex items-center justify-center mb-4 mx-auto"
          >
            {customIcon}
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className={`w-16 h-16 rounded-2xl ${variants.bg} ${variants.ring} flex items-center justify-center mb-4 mx-auto`}
          >
            <BarChartHorizontal size={32} className={"text-white"} />
          </motion.div>
        )}

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl font-bold text-center text-foreground mb-2"
        >
          {title}
        </motion.h3>

        {/* Optional Description */}
        {description && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-sm text-center text-muted-foreground mb-4"
          >
            {description}
          </motion.p>
        )}

        {/* Warning if no activities logged today */}
        {showActivityWarning && !hasActivitiesToday && (
          <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                  Metrics are most important to log after an activity
                </p>
                <button
                  onClick={() => {
                    handleClose();
                    navigate({ to: "/add" });
                  }}
                  className="text-sm text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 font-medium flex items-center gap-1 transition-colors"
                >
                  Log an activity first
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Metric Islands */}
        <div className="flex flex-col gap-3">
          {metrics?.map((metric) => {
            return (
              <MetricIsland
                key={metric.id}
                metric={metric}
                isLoggedToday={false}
                isSkippedToday={false}
                onRatingChange={handleRatingChange}
                controlledRating={pendingRatings[metric.id]}
              />
            );
          })}
        </div>

        {/* Note input - shown when all metrics have pending ratings */}
        {allMetricsHavePendingRating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-4 border-t border-border space-y-4"
          >
            <TextAreaWithVoice
              value={pendingNote}
              onChange={setPendingNote}
              label="Anything to add?"
              placeholder="Add any additional thoughts or notes about your day..."
              disabled={isSubmitting}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={isSubmitting}
                className="text-muted-foreground hover:text-foreground"
              >
                Skip
              </Button>
              <Button
                onClick={handleClose}
                disabled={isSubmitting}
                size="sm"
                className={`text-white ${variants.bg}`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Done"
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </AppleLikePopover>
  );
};
