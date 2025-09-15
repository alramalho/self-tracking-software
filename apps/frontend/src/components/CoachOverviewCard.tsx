import { useApiWithAuth } from "@/api";
import { CompletePlan, usePlans } from "@/contexts/plans";
import { useCoachMessages } from "@/hooks/useCoachMessages";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { PlanSession } from "@tsw/prisma";
import { formatDistance } from "date-fns";
import { Check, Loader2, MoveRight, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { MessageBubble } from "./MessageBubble";
import { PlanStatus } from "./PlanProgressCard";
import { SmallActivityEntryCard } from "./SmallActivityEntryCard";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";

interface CoachOverviewCardProps {
  selectedPlan: CompletePlan;
  activities: any[];
  isDemo?: boolean;
  className?: string;
}

export const CoachOverviewCard: React.FC<CoachOverviewCardProps> = ({
  selectedPlan,
  activities,
  isDemo = false,
  className,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const api = useApiWithAuth();
  const {
    upsertPlan,
    clearCoachSuggestedSessionsInPlan,
    upgradeCoachSuggestedSessionsToPlanSessions,
  } = usePlans();
  const { getLastCoachMessage, shouldUseCoachMessage } = useCoachMessages();
  const [selectedSuggestedSession, setSelectedSuggestedSession] = useState<
    string | null
  >(null);
  const coachSuggestedSessions = selectedPlan.sessions?.filter(
    (s) => s.isCoachSuggested
  );
  const [loadingStates, setLoadingStates] = useState({
    acceptingSessions: false,
    decliningSessions: false,
    acceptingTimesPerWeek: false,
    decliningTimesPerWeek: false,
  });

  const planActivities = activities.filter((a) =>
    selectedPlan.activities.map((a) => a.id).includes(a.id)
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

      let updateData = {};
      if (suggestionType === "sessions") {
        await upgradeCoachSuggestedSessionsToPlanSessions(selectedPlan.id);
        updateData = {
          coachNotes: null,
        };
      } else if (suggestionType === "timesPerWeek") {
        updateData = {
          timesPerWeek: selectedPlan.coachSuggestedTimesPerWeek,
          coachSuggestedTimesPerWeek: null,
          coachNotes: null,
        };
      }

      await upsertPlan({ planId: selectedPlan.id, updates: updateData });
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

      let updateData = {};
      if (suggestionType === "sessions") {
        clearCoachSuggestedSessionsInPlan(selectedPlan.id);
        updateData = {
          coachNotes: null,
        };
      } else if (suggestionType === "timesPerWeek") {
        updateData = {
          coachSuggestedTimesPerWeek: null,
          coachNotes: null,
        };
      }

      await upsertPlan({
        planId: selectedPlan.id,
        updates: updateData,
        muteNotifications: true,
      });

      toast.success("Suggestion declined");
    } catch (error) {
      console.error("Failed to decline suggestion:", error);
      toast.error("Failed to decline suggestion");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  // Get coach message data
  const useCoachMessage = shouldUseCoachMessage(selectedPlan);
  const lastCoachMessage = useCoachMessage
    ? getLastCoachMessage(selectedPlan)
    : null;

  // Don't render if no coach data to show
  const hasCoachNotes = !useCoachMessage && selectedPlan.coachNotes;
  const hasCoachMessage = useCoachMessage && lastCoachMessage;

  if (
    !hasCoachNotes &&
    !hasCoachMessage &&
    !coachSuggestedSessions.length &&
    !selectedPlan.coachSuggestedTimesPerWeek
  ) {
    return null;
  }

  return (
    <MessageBubble
      direction="left"
      className={cn(
        variants.veryFadedBg,
        variants.ringBright,
        "backdrop-blur-sm ring-1 p-4",
        className
      )}
    >
      <div className="flex flex-row items-center gap-4">
        {(hasCoachNotes || hasCoachMessage) && (
          <>
            <Avatar>
              <AvatarImage src="https://alramalhosandbox.s3.eu-west-1.amazonaws.com/tracking_software/jarvis_logo_transparent.png" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1 flex-1">
              <span className={`text-sm italic text-gray-600`}>
                {hasCoachMessage
                  ? lastCoachMessage?.message
                  : selectedPlan.coachNotes}
              </span>
              <div className="flex flex-row items-center justify-between gap-2 mt-1">
                <span className="text-[10px] italic text-gray-500">
                  Coach Oli,{" "}
                  {hasCoachMessage && lastCoachMessage
                    ? formatDistance(lastCoachMessage.createdAt, new Date(), {
                        addSuffix: true,
                      })
                    : selectedPlan.suggestedByCoachAt &&
                      formatDistance(
                        selectedPlan.suggestedByCoachAt,
                        new Date(),
                        {
                          addSuffix: true,
                        }
                      )}
                </span>
                <PlanStatus plan={selectedPlan} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {coachSuggestedSessions && coachSuggestedSessions.length > 0 && (
          <div className="flex flex-col justify-start gap-4 w-full">
            <div className="flex flex-col gap-3">
              <div className="flex flex-row gap-2">
                {!hasCoachNotes && !hasCoachMessage && (
                  <Avatar>
                    <AvatarImage src="https://alramalhosandbox.s3.eu-west-1.amazonaws.com/tracking_software/jarvis_logo_transparent.png" />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                )}
                <div className="text-start">
                  <span className="text-lg font-semibold text-gray-800 block">
                    New Schedule Suggestion
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    UPDATED SESSIONS
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                {coachSuggestedSessions.map(
                  (session: PlanSession, index: number) => {
                    const activity = planActivities?.find(
                      (a) => a.id === session.activityId
                    );
                    if (!activity) return null;

                    const sessionId = `coach-session-${session.activityId}-${index}`;
                    const isSelected = selectedSuggestedSession === sessionId;

                    return (
                      <SmallActivityEntryCard
                        key={sessionId}
                        entry={{
                          date: session.date,
                          activityId: session.activityId,
                          quantity: session.quantity,
                          description: session.descriptiveGuide,
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

        {selectedPlan.coachSuggestedTimesPerWeek != undefined &&
          selectedPlan.coachSuggestedTimesPerWeek != null &&
          selectedPlan.coachSuggestedTimesPerWeek > 0 && (
            <div className="flex flex-col justify-start gap-4 w-full mt-3">
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
                  <MoveRight className="h-5 w-5 md:h-6 md:w-6 text-gray-400 mx-2" />
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
