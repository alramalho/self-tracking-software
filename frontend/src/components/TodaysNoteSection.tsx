import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaWithVoice } from "@/components/ui/TextAreaWithVoice";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import { Loader2, Check, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { cn } from "@/lib/utils";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useDailyCheckin } from "@/contexts/DailyCheckinContext";

interface TodaysNoteSectionProps {
  onSubmitted?: () => void;
}

export const TodaysNoteSection: React.FC<TodaysNoteSectionProps> = ({
  onSubmitted,
}) => {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [wasSkipped, setWasSkipped] = useState(false);
  const [existingNote, setExistingNote] = useState<string>("");
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const api = useApiWithAuth();
  const { useMetricsAndEntriesQuery } = useUserPlan();
  const { data: metricsAndEntriesData } = useMetricsAndEntriesQuery();
  const entries = metricsAndEntriesData?.entries || [];
  const { skipTodaysNote } = useDailyCheckin();

  // Check if any of today's entries already have descriptions or are skipped
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const todaysEntries = entries.filter(
      entry => entry.date.split("T")[0] === today
    );
    
    // Check if any entry has a description
    const entryWithDescription = todaysEntries.find(entry => 
      entry.description && entry.description.trim() !== ""
    );
    
    // Check if any entry has description_skipped set to true
    const entryWithSkippedDescription = todaysEntries.find(entry => 
      entry.description_skipped === true
    );
    
    if (entryWithDescription && entryWithDescription.description) {
      setExistingNote(entryWithDescription.description);
      setIsSubmitted(true);
      setWasSkipped(false);
    } else if (entryWithSkippedDescription) {
      setIsSubmitted(true);
      setWasSkipped(true);
    } else {
      setIsSubmitted(false);
      setWasSkipped(false);
    }
  }, [entries]);

  const handleSubmit = async () => {
    if (!note.trim()) {
      toast.error("Please add a note before submitting");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/log-todays-note", {
        note: note.trim(),
      });

      setExistingNote(note.trim());
      setIsSubmitted(true);
      setWasSkipped(false);
      toast.success("Note added to today's entries!");
      onSubmitted?.();
    } catch (error) {
      console.error("Error submitting note:", error);
      toast.error("Failed to add note. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    try {
      await skipTodaysNote();
      setIsSubmitted(true);
      setWasSkipped(true);
      onSubmitted?.();
    } catch (error) {
      console.error("Error skipping note:", error);
      toast.error("Failed to skip note. Please try again.");
    }
  };

  if (isSubmitted) {
    const hasNote = existingNote || note.trim();
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 0.9, y: 0 }}
        className={`ring-1 rounded-3xl p-4 backdrop-blur-sm ${cn(
          hasNote && !wasSkipped
            ? `${variants.card.softGlassBg} ${variants.ringSoft}` // Use variants for submitted notes
            : "bg-gray-50 ring-gray-200" // Use gray for skipped
        )}`}
      >
        <div className="flex items-center gap-2">
          {hasNote && !wasSkipped ? (
            <Check className={`w-5 h-5 ${variants.text}`} />
          ) : (
            <XCircle className={`w-5 h-5 text-gray-500`} />
          )}
          <span className="text-sm font-normal italic text-gray-500">
            {hasNote && !wasSkipped
              ? "Note added to today's entries!"
              : "Skipped adding note today"}
          </span>
        </div>
        {hasNote && !wasSkipped && (
          <div className="mt-2 text-xs text-gray-400 italic">
            &quot;{existingNote || note.trim()}&quot;
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="ring-1 rounded-3xl p-4 bg-white/60 backdrop-blur-sm ring-gray-200 shadow-sm"
    >
      <div className="space-y-4">
        <TextAreaWithVoice
          value={note}
          onChange={setNote}
          label="Anything to add?"
          placeholder="Add any additional thoughts or notes about your day..."
          disabled={isSubmitting}
        />

        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="text-gray-500 hover:text-gray-700"
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !note.trim()}
            size="sm"
            className={` text-white ${variants.bg}`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Adding Note...
              </>
            ) : (
              "Add Note"
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
