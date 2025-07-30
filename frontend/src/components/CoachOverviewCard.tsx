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
  const api = useApiWithAuth();
  const [selectedSuggestedSession, setSelectedSuggestedSession] = useState<string | null>(null);
  const [loadingStates, setLoadingStates] = useState({
    acceptingSessions: false,
    decliningSessions: false,
    acceptingTimesPerWeek: false,
    decliningTimesPerWeek: false,
  });

  const planActivities = activities.filter((a) =>
    selectedPlan.activityIds?.includes(a.id)
  );

  // Reusable functions for handling coach suggestions
  const handleAcceptSuggestion = async (
    suggestionType: "sessions" | "timesPerWeek"
  ) => {
    if (isDemo || !api) return;

    const loadingKey =
      suggestionType === "sessions"
        ? "acceptingSessions"
        : "acceptingTimesPerWeek";

    try {
      setLoadingStates((prev) => ({ ...prev, [loadingKey]: true }));

      let updateData: any = {
        suggestedByCoachAt: null,
        coachNotes: null,
      };

      if (suggestionType === "sessions") {
        updateData = {
          ...updateData,
          sessions: selectedPlan.coachSuggestedSessions,
          coachSuggestedSessions: null,
        };
      } else if (suggestionType === "timesPerWeek") {
        updateData = {
          ...updateData,
          timesPerWeek: selectedPlan.coachSuggestedTimesPerWeek,
          coachSuggestedTimesPerWeek: null,
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
    suggestionType: "sessions" | "timesPerWeek"
  ) => {
    if (isDemo || !api) return;

    const loadingKey =
      suggestionType === "sessions"
        ? "decliningSessions"
        : "decliningTimesPerWeek";

    try {
      setLoadingStates((prev) => ({ ...prev, [loadingKey]: true }));

      let updateData: any = {
        suggestedByCoachAt: null,
        coachNotes: null,
      };

      if (suggestionType === "sessions") {
        updateData.coachSuggestedSessions = null;
      } else if (suggestionType === "timesPerWeek") {
        updateData.coachSuggestedTimesPerWeek = null;
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
  if (!selectedPlan.coachNotes &&
      !selectedPlan.coachSuggestedSessions?.length &&
      !selectedPlan.coachSuggestedTimesPerWeek) {
    return null;
  }

  return (
    <MessageBubble
      direction="left"
      className={cn(
        variants.veryFadedBg,
        variants.ringBright,
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

        {selectedPlan.coachNotes && (
          <div className="flex flex-col gap-1 flex-1">
            <span className={`text-sm italic text-gray-600`}>
              {selectedPlan.coachNotes}
            </span>
            <span className="text-[10px] italic text-gray-500">
              Coach Oli,{" "}
              {selectedPlan.suggestedByCoachAt &&
                formatDistance(
                  parseISO(selectedPlan.suggestedByCoachAt),
                  new Date(),
                  { addSuffix: true }
                )}
            </span>
          </div>
        )}

        {selectedPlan.coachSuggestedSessions &&
          selectedPlan.coachSuggestedSessions.length > 0 && (
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
                  {selectedPlan.coachSuggestedSessions.map(
                    (session, index) => {
                      const activity = planActivities?.find(
                        (a) => a.id === session.activityId
                      );
                      if (!activity) return null;

                      const sessionId = `coach-session-${session.activityId}-${index}`;
                      const isSelected =
                        selectedSuggestedSession === sessionId;

                      return (
                        <SmallActivityEntryCard
                          key={sessionId}
                          entry={{
                            date: parseISO(session.date),
                            activityId: session.activityId,
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

        {selectedPlan.coachSuggestedTimesPerWeek && (
          <div className="flex flex-col justify-start gap-4 w-full">
            <div className="flex flex-row justify-center items-center gap-4 md:gap-8">
              <div className="flex flex-col items-center text-center flex-shrink-0">
                <span className="text-4xl md:text-5xl font-light text-gray-800">
                  {selectedPlan.timesPerWeek}
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
                  {selectedPlan.coachSuggestedTimesPerWeek}
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
                    await handleDeclineSuggestion("timesPerWeek");
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
                    await handleAcceptSuggestion("timesPerWeek");
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