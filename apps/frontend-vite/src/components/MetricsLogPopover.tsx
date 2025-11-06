import AppleLikePopover from "@/components/AppleLikePopover";
import { MetricIsland } from "@/components/MetricIsland";
import { TodaysNoteSection } from "@/components/TodaysNoteSection";
import { useActivities } from "@/contexts/activities/useActivities";
import { useDailyCheckin } from "@/contexts/daily-checkin";
import { useMetrics } from "@/contexts/metrics";
import { useNavigate } from "@tanstack/react-router";
import { isToday } from "date-fns";
import { AlertTriangle, BarChartHorizontal, ChevronRight } from "lucide-react";
import React from "react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { motion } from "framer-motion";

interface MetricsLogPopoverProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  customIcon?: React.ReactNode;
}

export const MetricsLogPopover: React.FC<MetricsLogPopoverProps> = ({
  open,
  onClose,
  title = "Log Your Metrics",
  description,
  customIcon,
}) => {
  const navigate = useNavigate();
  const { metrics } = useMetrics();
  const { activityEntries } = useActivities();
  const { areAllMetricsCompleted } = useDailyCheckin();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Check if any activities were logged today
  const hasActivitiesToday = activityEntries?.some((entry) =>
    isToday(entry.date)
  );

  return (
    <AppleLikePopover open={open} onClose={onClose} displayIcon={false}>
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
        {!hasActivitiesToday && (
          <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                  Metrics are most important to log after an activity
                </p>
                <button
                  onClick={() => {
                    onClose();
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
              />
            );
          })}
        </div>

        {/* Today's Note Section - shown when all metrics completed */}
        {areAllMetricsCompleted && (
          <div className="pt-4 border-t border-border">
            <TodaysNoteSection />
          </div>
        )}
      </div>
    </AppleLikePopover>
  );
};
