import { Check, ScanFace, X } from "lucide-react";
import { useRouter } from "next/navigation";
import AppleLikePopover from "./AppleLikePopover";
import { TextAreaWithVoice } from "./ui/TextAreaWithVoice";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useApiWithAuth } from "@/api";
import { Toaster, toast } from "sonner";
import { toast as hotToast } from "react-hot-toast";
import { EntryCard } from "./EntryCard";
import { motion, AnimatePresence } from "framer-motion";

import {
  Activity,
  ActivityEntry,
  MetricEntry,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { Checkbox } from "./ui/checkbox";
import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { formatDate } from "date-fns";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const checkboxContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const checkboxVariants = {
  unchecked: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.2 },
  },
  checked: {
    scale: [1, 1.1, 1],
    opacity: 1,
    transition: {
      duration: 0.4,
      times: [0, 0.5, 1],
      ease: "easeInOut",
    },
  },
};

export const getRelativeDate = (date: Date) => {
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(date, "MMM d, yyyy");
};

interface DailyCheckinBannerProps {
  open: boolean;
  onClose: () => void;
}

export function DailyCheckinBanner({ open, onClose }: DailyCheckinBannerProps) {
  const now = new Date();
  const hours = now.getHours();
  const isAfter4PM = hours >= 16;
  const [text, setText] = useState("");
  const [rejectionFeedbackOpen, setRejectionFeedbackOpen] = useState(false);
  const [rejectionFeedback, setRejectionFeedback] = useState("");

  const { useMetricsAndEntriesQuery, useCurrentUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserQuery;
  const activities = userData?.activities || [];
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const api = useApiWithAuth();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData } = metricsAndEntriesQuery;
  const metrics = metricsAndEntriesData?.metrics;

  const [metricsEntries, setMetricsEntries] = useState<MetricEntry[]>([]);
  const [activitiesEntries, setActivitiesEntries] = useState<ActivityEntry[]>(
    []
  );

  const questionsChecks = {
    ...metrics?.reduce(
      (acc, m) => ({
        ...acc,
        [`Your ${m.title} today on a scale of 1-5`]: `the user mentioned their ${m.title} metric`,
      }),
      {}
    ),
    "what have you done today (and for how long)":
      "what has the user done today",
  };

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.keys(questionsChecks).map((key) => [key, false]))
  );

  // Add refs for scrolling
  const containerRef = useRef<HTMLDivElement>(null);
  const checkboxesRef = useRef<HTMLDivElement>(null);
  const extractedDataRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Smooth scroll function
  const scrollToRef = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await api.post(`/ai/get-daily-checkin-extractions`, {
        message: text,
        question_checks: questionsChecks,
      });
      return response.data;
    },
    onSuccess: (data) => {
      // First checkbox animation
      Object.keys(data.question_checks).forEach((key, index) => {
        setTimeout(() => {
          setCheckedItems((prev) => ({
            ...prev,
            [key]: data.question_checks[key],
          }));
          // Scroll to checkboxes after first item is checked
          if (index === 0) {
            scrollToRef(checkboxesRef);
          }
        }, index * 150);
      });

      toast(`💬 ${data.message}`);

      // Then show extracted data after checkboxes
      const totalCheckboxDelay =
        Object.keys(data.question_checks).length * 150 + 300;

      setTimeout(() => {
        setMetricsEntries(data.metric_entries);
        setActivitiesEntries(data.activity_entries);
        setIsLoading(false);

        // Scroll to extracted data after it appears
        setTimeout(() => {
          scrollToRef(extractedDataRef);
        }, 100);

        // Scroll to actions after another delay
        setTimeout(() => {
          scrollToRef(actionsRef);
        }, 600);
      }, totalCheckboxDelay);
    },
    onMutate: () => {
      setIsLoading(true);
      // Reset state
      setCheckedItems(
        Object.fromEntries(
          Object.keys(questionsChecks).map((key) => [key, false])
        )
      );
      setMetricsEntries([]);
      setActivitiesEntries([]);
    },
    onError: () => {
      console.error("Error submitting daily checkin");
      setIsLoading(false);
    },
  });

  const logMetricMutation = useMutation({
    mutationFn: async (entry: MetricEntry) => {
      const response = await api.post("/log-metric", {
        metric_id: entry.metric_id,
        rating: entry.rating,
        date: entry.date,
      });
      return response.data;
    },
  });

  const logActivityMutation = useMutation({
    mutationFn: async (entry: ActivityEntry) => {
      const formData = new FormData();
      formData.append("activity_id", entry.activity_id);
      formData.append("iso_date_string", entry.date);
      formData.append("quantity", entry.quantity.toString());

      const response = await api.post("/log-activity", formData);
      return response.data;
    },
  });

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      // Log all metric entries
      await Promise.all(
        metricsEntries.map((entry) => logMetricMutation.mutateAsync(entry))
      );

      // Log all activity entries
      await Promise.all(
        activitiesEntries.map((entry) => logActivityMutation.mutateAsync(entry))
      );

      // Refresh the queries to get updated data
      metricsAndEntriesQuery.refetch();
      currentUserQuery.refetch();

      hotToast.success("Successfully processed your daily checkin!");
      onClose();
    } catch (error) {
      hotToast.error("Failed to process your daily checkin");
      console.error("Error processing daily checkin:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextChange = (value: string) => {
    setText(value);
  };

  return (
    <>
      <AppleLikePopover open={open} onClose={onClose}>
        <motion.div
          ref={containerRef}
          className="space-y-4 max-h-[80vh] overflow-y-auto"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <Toaster position="top-center" closeButton duration={12000} />

          <motion.h2
            variants={itemVariants}
            className="text-sm text-gray-500 m-4 mt-6 text-center"
          >
            Daily checkin time! 😊
          </motion.h2>

          <motion.div variants={itemVariants}>
            <ScanFace size={100} className="mx-auto" />
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="text-center text-lg font-semibold"
          >
            {isAfter4PM ? "How was your day?" : "How are you feeling today?"}
          </motion.p>

          <motion.div variants={itemVariants} className="w-full px-4">
            <TextAreaWithVoice
              value={text}
              onChange={handleTextChange}
              placeholder={
                isAfter4PM
                  ? "tell us how was your day"
                  : "tell us how are you feeling today"
              }
            />
          </motion.div>

          <motion.div variants={itemVariants} className="px-4">
            <Button
              className="w-full"
              onClick={() => submitMutation.mutateAsync(text)}
              disabled={isLoading}
              loading={isLoading}
            >
              Submit
            </Button>
          </motion.div>

          <motion.div
            ref={checkboxesRef}
            className="space-y-3 mt-12 px-4"
            variants={checkboxContainerVariants}
          >
            <motion.p variants={itemVariants} className="text-sm text-gray-500">
              Be sure to mention:
            </motion.p>
            {Object.keys(questionsChecks).map((key) => (
              <motion.div
                key={key}
                className="flex items-center space-x-2"
                initial="unchecked"
                animate={checkedItems[key] ? "checked" : "unchecked"}
                variants={checkboxVariants}
              >
                <Checkbox checked={checkedItems[key] || false} disabled />
                <label className="text-sm text-gray-700">{key}</label>
              </motion.div>
            ))}
          </motion.div>

          <AnimatePresence>
            {(metricsEntries.length > 0 || activitiesEntries.length > 0) && (
              <motion.div
                ref={extractedDataRef}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.5 }}
              >
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm text-gray-500 text-left w-full px-4 mt-4"
                >
                  <div className="text-sm text-gray-500 mt-8 text-left w-full mt-4">
                    <p className="flex flex-row gap-2">
                      <ScanFace size={24} />
                      I&apos;ve extracted the following data from your message
                    </p>
                  </div>
                </motion.p>
                <motion.div
                  className="flex flex-row no-wrap justify-around mt-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  <motion.div
                    className="flex flex-col gap-2"
                    variants={itemVariants}
                  >
                    {metricsEntries.length > 0 && (
                      <motion.h2
                        variants={itemVariants}
                        className="text-md font-semibold text-left"
                      >
                        Metrics
                      </motion.h2>
                    )}
                    <motion.div
                      className="flex flex-col gap-2"
                      variants={containerVariants}
                    >
                      {metricsEntries?.map((m, index) => {
                        const respectiveMetric = metrics?.find(
                          (metric) => metric.id === m.metric_id
                        );
                        return (
                          <motion.div
                            key={m.id}
                            variants={itemVariants}
                            custom={index}
                            initial="hidden"
                            animate="show"
                            transition={{ delay: index * 0.1 }}
                          >
                            <EntryCard
                              emoji={respectiveMetric?.emoji || ""}
                              title={respectiveMetric?.title || ""}
                              description={`${m.rating} / 5`}
                              date={new Date(m.date)}
                            />
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </motion.div>
                  <motion.div
                    className="flex flex-col gap-2"
                    variants={itemVariants}
                  >
                    {activitiesEntries.length > 0 && (
                      <motion.h2
                        variants={itemVariants}
                        className="text-md font-semibold text-left"
                      >
                        Activities
                      </motion.h2>
                    )}
                    <motion.div
                      className="flex flex-col gap-2"
                      variants={containerVariants}
                    >
                      {activitiesEntries?.map((a, index) => {
                        const respectiveActivity = activities?.find(
                          (activity) => activity.id === a.activity_id
                        );
                        return (
                          <motion.div
                            key={a.id}
                            variants={itemVariants}
                            custom={index}
                            initial="hidden"
                            animate="show"
                            transition={{ delay: index * 0.1 }}
                          >
                            <EntryCard
                              emoji={respectiveActivity?.emoji || ""}
                              title={respectiveActivity?.title || ""}
                              description={`${a.quantity} ${respectiveActivity?.measure}`}
                              date={new Date(a.date)}
                            />
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(metricsEntries.length > 0 || activitiesEntries.length > 0) && (
              <motion.div
                ref={actionsRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: 0.5 }}
              >
                <div className="text-sm text-gray-500 mt-8 text-left w-full px-4 mt-4">
                  <p className="flex flex-row gap-2">
                    <ScanFace size={24} />
                    Do you want me to log them for you?
                  </p>
                </div>
                <div className="flex flex-row gap-2 justify-center mt-4">
                  <Button
                    variant="outline"
                    className="w-full flex items-center gap-2 text-red-600"
                    onClick={() => setRejectionFeedbackOpen(true)}
                    disabled={isSubmitting}
                  >
                    <X className="w-6 h-6" />
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full flex items-center gap-2 text-green-600"
                    onClick={handleAccept}
                    disabled={isSubmitting}
                    loading={isSubmitting}
                  >
                    <Check className="w-6 h-6" />
                    Accept
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AppleLikePopover>

      <AppleLikePopover
        open={rejectionFeedbackOpen}
        onClose={() => setRejectionFeedbackOpen(false)}
      >
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-gray-500 m-4 mt-6 text-center"
          >
            Would you care to tell us why you&apos;re rejecting these?
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="px-4 w-full"
          >
            <TextAreaWithVoice
              value={rejectionFeedback}
              onChange={(value) => setRejectionFeedback(value)}
              placeholder="Tell us what we got wrong..."
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="px-4"
          >
            <Button
              className="w-full"
              onClick={() => {
                // Handle rejection submission
                setRejectionFeedbackOpen(false);
              }}
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              Submit Feedback
            </Button>
          </motion.div>
        </motion.div>
      </AppleLikePopover>
    </>
  );
}
