import React, { useState } from "react";
import { parseISO, formatDistance } from "date-fns";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { useThemeColors } from "@/hooks/useThemeColors";
import { MessageBubble } from "./MessageBubble";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { PlanStatus } from "./PlanProgressCard";
import { Button } from "./ui/button";
import { SmallActivityEntryCard } from "./SmallActivityEntryCard";
import {
  ArrowBigRight,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { ApiPlan, convertApiPlanToPlan } from "@/contexts/UserPlanContext";
import { toast } from "react-hot-toast";
import { useApiWithAuth } from "@/api";

interface CoachOverviewCardProps {
  selectedPlan: ApiPlan;
  activities: any[];
  onRefetch?: () => void;
  isDemo?: boolean;
  className?: string;
}

export const CoachOverviewCard: React.FC<CoachOverviewCardProps> = ({
  selectedPlan,
  activities,
  onRefetch,
  isDemo = false,
  className,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const api = isDemo ? null : useApiWithAuth();
  const [selectedSuggestedSession, setSelectedSuggestedSession] = useState<string | null>(null);
  const [loadingStates, setLoadingStates] = useState({
    acceptingSessions: false,
    decliningSessions: false,
    acceptingTimesPerWeek: false,
    decliningTimesPerWeek: false,
  });

  const planActivities = activities.filter((a) =>
    selectedPlan.activity_ids?.includes(a.id)
  );

  // Reusable functions for handling coach suggestions
  const handleAcceptSuggestion = async (
    suggestionType: "sessions" | "times_per_week"
  ) => {
    if (isDemo || !api) return;

    const loadingKey =
      suggestionType === "sessions"
        ? "acceptingSessions"
        : "acceptingTimesPerWeek";

    try {
      setLoadingStates((prev) => ({ ...prev, [loadingKey]: true }));

      let updateData: any = {
        suggested_by_coach_at: null,
        coach_notes: null,
      };

      if (suggestionType === "sessions") {
        updateData = {
          ...updateData,
          sessions: selectedPlan.coach_suggested_sessions,
          coach_suggested_sessions: null,
        };
      } else if (suggestionType === "times_per_week") {
        updateData = {
          ...updateData,
          times_per_week: selectedPlan.coach_suggested_times_per_week,
          coach_suggested_times_per_week: null,
        };
      }

      await api.post(`/plans/${selectedPlan.id}/update`, {
        data: updateData,
      });
      onRefetch?.();
      toast.success(
        suggestionType === "sessions"
          ? "Schedule updated successfully!"
          : "Plan updated successfully!"
      );
    } catch (error) {
      console.error("Failed to accept suggestion:", error);
      toast.error(
        suggestionType === "sessions"
          ? "Failed to update schedule"
          : "Failed to update plan"
      );
    } finally {
      setLoadingStates((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  const handleDeclineSuggestion = async (
    suggestionType: "sessions" | "times_per_week"
  ) => {
    if (isDemo || !api) return;

    const loadingKey =
      suggestionType === "sessions"
        ? "decliningSessions"
        : "decliningTimesPerWeek";

    try {
      setLoadingStates((prev) => ({ ...prev, [loadingKey]: true }));

      let updateData: any = {
        suggested_by_coach_at: null,
        coach_notes: null,
      };

      if (suggestionType === "sessions") {
        updateData.coach_suggested_sessions = null;
      } else if (suggestionType === "times_per_week") {
        updateData.coach_suggested_times_per_week = null;
      }

      await api.post(`/plans/${selectedPlan.id}/update`, {
        data: updateData,
      });
      onRefetch?.();
      toast.success("Suggestion declined");
    } catch (error) {
      console.error("Failed to decline suggestion:", error);
      toast.error("Failed to decline suggestion");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  // Don't render if no coach data to show
  if (!selectedPlan.coach_notes &&
      !selectedPlan.coach_suggested_sessions?.length &&
      !selectedPlan.coach_suggested_times_per_week) {
    return null;
  }

  return (
    <MessageBubble
      direction="left"
      className={cn(
        variants.card.softGlassBg,
        variants.ringSoft,
        "backdrop-blur-sm ring-1",
        className
      )}
    >
      <div className="flex flex-col items-start gap-4">
        <div className="flex flex-row items-center gap-2 justify-between w-full">
          <Avatar>
            <AvatarImage src="https://alramalhosandbox.s3.eu-west-1.amazonaws.com/tracking_software/jarvis_logo_transparent.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <PlanStatus
            plan={convertApiPlanToPlan(selectedPlan, activities)}
          />
        </div>

        {selectedPlan.coach_notes && (
          <div className="flex flex-col gap-1 flex-1">
            <span className={`text-sm italic text-gray-600`}>
              {selectedPlan.coach_notes}
            </span>
            <span className="text-[10px] italic text-gray-500">
              Coach Oli,{" "}
              {selectedPlan.suggested_by_coach_at &&
                formatDistance(
                  parseISO(selectedPlan.suggested_by_coach_at),
                  new Date(),
                  { addSuffix: true }
                )}
            </span>
          </div>
        )}

        {selectedPlan.coach_suggested_sessions &&
          selectedPlan.coach_suggested_sessions.length > 0 && (
            <div className="flex flex-col justify-start gap-4 w-full">
              <div className="flex flex-col gap-3">
                <div className="text-center">
                  <span className="text-lg font-semibold text-gray-800 mb-2 block">
                    New Schedule Suggestion
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    UPDATED SESSIONS
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                  {selectedPlan.coach_suggested_sessions.map(
                    (session, index) => {
                      const activity = planActivities?.find(
                        (a) => a.id === session.activity_id
                      );
                      if (!activity) return null;

                      const sessionId = `coach-session-${session.activity_id}-${index}`;
                      const isSelected =
                        selectedSuggestedSession === sessionId;

                      return (
                        <SmallActivityEntryCard
                          key={sessionId}
                          entry={{
                            date: parseISO(session.date),
                            activity_id: session.activity_id,
                            quantity: session.quantity,
                            description: session.descriptive_guide,
                          }}
                          activity={activity}
                          selected={isSelected}
                          onClick={(clickedSessionId) => {
                            setSelectedSuggestedSession(
                              clickedSessionId === selectedSuggestedSession
                                ? null
                                : clickedSessionId
                            );
                          }}
                          className={`border-2 ${variants.veryFadedBg} ${variants.border}`}
                        />
                      );
                    }
                  )}
                </div>
              </div>

              {!isDemo && (
                <div className="flex flex-row gap-3 justify-center">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 text-sm font-medium border-gray-200 text-gray-600"
                    disabled={
                      loadingStates.decliningSessions ||
                      loadingStates.acceptingSessions
                    }
                    onClick={async () => {
                      await handleDeclineSuggestion("sessions");
                    }}
                  >
                    {loadingStates.decliningSessions ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Decline
                  </Button>
                  <Button
                    className={`flex-1 h-10 text-sm font-medium ${variants.bg}`}
                    disabled={
                      loadingStates.acceptingSessions ||
                      loadingStates.decliningSessions
                    }
                    onClick={async () => {
                      await handleAcceptSuggestion("sessions");
                    }}
                  >
                    {loadingStates.acceptingSessions ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Accept
                  </Button>
                </div>
              )}
            </div>
          )}

        {selectedPlan.coach_suggested_times_per_week && (
          <div className="flex flex-col justify-start gap-4 w-full">
            <div className="flex flex-row justify-center items-center gap-4 md:gap-8">
              <div className="flex flex-col items-center text-center flex-shrink-0">
                <span className="text-4xl md:text-5xl font-light text-gray-800">
                  {selectedPlan.times_per_week}
                </span>
                <span className="text-xs text-gray-400 font-medium mt-1">
                  CURRENT
                </span>
              </div>

              <div className="flex items-center flex-shrink-0">
                <div className="w-8 md:w-16 h-px bg-gray-300"></div>
                <ArrowBigRight className="h-5 w-5 md:h-6 md:w-6 text-gray-400 mx-2" />
                <div className="w-8 md:w-16 h-px bg-gray-300"></div>
              </div>

              <div className="flex flex-col items-center text-center flex-shrink-0">
                <span
                  className={`text-4xl md:text-5xl font-light ${variants.text}`}
                >
                  {selectedPlan.coach_suggested_times_per_week}
                </span>
                <span className="text-xs text-gray-400 font-medium mt-1">
                  SUGGESTED
                </span>
              </div>
            </div>

            {!isDemo && (
              <div className="flex flex-row gap-3 justify-center">
                <Button
                  variant="outline"
                  className="flex-1 h-10 text-sm font-medium border-gray-200 text-gray-600"
                  disabled={
                    loadingStates.decliningTimesPerWeek ||
                    loadingStates.acceptingTimesPerWeek
                  }
                  onClick={async () => {
                    await handleDeclineSuggestion("times_per_week");
                  }}
                >
                  {loadingStates.decliningTimesPerWeek ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Decline
                </Button>
                <Button
                  className={`flex-1 h-10 text-sm font-medium ${variants.bg}`}
                  disabled={
                    loadingStates.acceptingTimesPerWeek ||
                    loadingStates.decliningTimesPerWeek
                  }
                  onClick={async () => {
                    await handleAcceptSuggestion("times_per_week");
                  }}
                >
                  {loadingStates.acceptingTimesPerWeek ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Accept
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </MessageBubble>
  );
}; 