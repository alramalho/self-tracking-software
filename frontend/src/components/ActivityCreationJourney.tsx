"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Activity, useUserPlan } from "@/contexts/UserPlanContext";
import { Calendar } from "@/components/ui/calendar";
import EmojiPicker from "emoji-picker-react";
import { Plus, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import ActivityPhotoUploader from "./ActivityPhotoUploader";
import { useApiWithAuth } from "@/api";

interface ActivityCreationJourneyProps {
  onComplete: (activities: Activity[]) => Promise<void>;
}

interface StepProps {
  stepNumber: number;
  isVisible: boolean;
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement>;
}

const Step = React.forwardRef<HTMLDivElement, StepProps>(
  ({ stepNumber, isVisible, children }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: isVisible ? 1 : 0,
          scale: isVisible ? 1 : 0.95,
          pointerEvents: isVisible ? "auto" : "none",
        }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    );
  }
);
Step.displayName = "Step";

const Number = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "flex flex-shrink-0 items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium",
      className
    )}
  >
    {children}
  </span>
);

const ActivityCreationJourney: React.FC<ActivityCreationJourneyProps> = ({
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [activityDescription, setActivityDescription] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [measure, setMeasure] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createdActivityId, setCreatedActivityId] = useState<string>();
  const { refetchUserData } = useUserPlan();
  const api = useApiWithAuth();

  const stepRefs = {
    step1: useRef<HTMLDivElement>(null),
    step2: useRef<HTMLDivElement>(null),
    step3: useRef<HTMLDivElement>(null),
  };

  const scrollToStep = (stepNumber: number) => {
    const ref = stepRefs[`step${stepNumber}` as keyof typeof stepRefs];
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      scrollToStep(currentStep + 1);
    }
  };

  const handleCreateActivity = async () => {
    if (!activityDescription || !selectedEmoji || !measure) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post("/upsert-activity", {
        emoji: selectedEmoji,
        title: activityDescription,
        measure,
      });
      
      const savedActivity = response.data;
      setCreatedActivityId(savedActivity.id);
      await refetchUserData();
      setShowPhotoUploader(true);
    } catch (error) {
      console.error("Error saving activity:", error);
      toast.error("Failed to save activity. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateActivityEntry = async () => {
    setShowPhotoUploader(false);
    const activity: Activity = {
      id: createdActivityId!,
      title: activityDescription,
      emoji: selectedEmoji,
      measure: measure,
    };

    await onComplete([activity]);
  };

  return (
    <div
      className="space-y-6 relative"
      onClick={() => setShowEmojiPicker(false)}
    >
      <Step stepNumber={1} isVisible={true} ref={stepRefs.step1}>
        <div className="space-y-4">
          <label className="text-lg font-medium block flex items-center gap-2">
            <Number>1</Number>
            What activity would you like to track?
          </label>
          <Textarea
            value={activityDescription}
            onChange={(e) => setActivityDescription(e.target.value)}
            placeholder="E.g., Going to the gym, Reading books, Meditation..."
            className="text-[16px]"
          />
          {activityDescription && (
            <div className="flex justify-end">
              <Button onClick={handleNext}>Continue</Button>
            </div>
          )}
        </div>
      </Step>

      {currentStep >= 2 && (
        <Step stepNumber={2} isVisible={true} ref={stepRefs.step2}>
          <div className="space-y-4">
            <label className="text-lg font-medium block flex items-center gap-2">
              <Number>2</Number>
              Choose an emoji and how you want to measure it
            </label>

            <div className="flex gap-4 items-start">
              <div
                className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(!showEmojiPicker);
                }}
              >
                {selectedEmoji ? (
                  <span className="text-3xl">{selectedEmoji}</span>
                ) : (
                  <Plus className="h-6 w-6 text-gray-400" />
                )}
              </div>

              {showEmojiPicker && (
                <div
                  className="absolute mt-20"
                  onClick={(e) => e.stopPropagation()}
                >
                  <EmojiPicker
                    onEmojiClick={(data) => {
                      setSelectedEmoji(data.emoji);
                      setShowEmojiPicker(false);
                    }}
                  />
                </div>
              )}

              <Textarea
                value={measure}
                onChange={(e) => setMeasure(e.target.value)}
                placeholder="How do you measure this? (e.g., minutes, pages, sessions)"
                className="flex-1"
              />
            </div>

            {selectedEmoji && measure && (
              <div className="flex justify-end">
                <Button onClick={handleNext}>Continue</Button>
              </div>
            )}
          </div>
        </Step>
      )}

      {currentStep >= 3 && (
        <Step stepNumber={3} isVisible={true} ref={stepRefs.step3}>
          <div className="space-y-4">
            <label className="text-lg font-medium block flex items-center gap-2">
              <Number>3</Number>
              Let&apos;s log your first entry
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
                disableFutureDates={true}
              />

              <div>
                <h3 className="text-lg font-medium mb-4">
                  Number of {measure}?
                </h3>
                <div className="flex items-center justify-center space-x-4">
                  <Button
                    onClick={() => setQuantity(Math.max(0, quantity - 1))}
                    variant="outline"
                    size="icon"
                  >
                    -
                  </Button>
                  <span className="text-2xl font-bold">{quantity}</span>
                  <Button
                    onClick={() => setQuantity(quantity + 1)}
                    variant="outline"
                    size="icon"
                  >
                    +
                  </Button>
                </div>
                <div className="mt-4 flex justify-center space-x-2">
                  {[10, 30, 45, 60, 90].map((value) => (
                    <Button
                      key={value}
                      onClick={() => setQuantity(value)}
                      variant="secondary"
                      size="sm"
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleCreateActivity}
                disabled={isLoading || quantity === 0}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Activity"
                )}
              </Button>
            </div>
          </div>
        </Step>
      )}

      {showPhotoUploader && createdActivityId && (
        <ActivityPhotoUploader
          activityData={{
            activityId: createdActivityId,
            date: selectedDate,
            quantity: quantity,
          }}
          onClose={() => setShowPhotoUploader(false)}
          onSuccess={handleCreateActivityEntry}
        />
      )}
    </div>
  );
};

export default ActivityCreationJourney;
