import { MatchScoreExplainer } from "@/components/MatchScoreExplainer";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendations } from "@/contexts/recommendations";
import { useCurrentUser } from "@/contexts/users";
import { usePlans } from "@/contexts/plans";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useNavigate } from "@tanstack/react-router";
import { Info, UserCheck, UserPlus } from "lucide-react";
import React, { useState } from "react";

interface RecommendedUsersProps {
  selectedPlanId: string | null;
}

type SortBy = "overall" | "goals" | "location" | "age";

export const RecommendedUsers: React.FC<RecommendedUsersProps> = ({
  selectedPlanId,
}) => {
  const {
    recommendations,
    users: recommendedUsers,
    plans: recommendedPlans,
    isLoadingRecommendations,
  } = useRecommendations();
  const { sendFriendRequest, isSendingFriendRequest, currentUser } =
    useCurrentUser();
  const { plans: currentUserPlans } = usePlans();
  const navigate = useNavigate();
  const [selectedExplainer, setSelectedExplainer] = useState<string | null>(
    null
  );
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>("overall");
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Filter recommendations by selected plan
  const userRecommendations = recommendations.filter((rec) => {
    if (rec.recommendationObjectType !== "USER") return false;

    // Filter by selected plan if specified
    if (
      selectedPlanId &&
      typeof rec.metadata === "object" &&
      rec.metadata !== null
    ) {
      return (rec.metadata as any).relativeToPlanId === selectedPlanId;
    }

    return true;
  });

  const deduplicatedRecommendations = userRecommendations.reduce((acc, rec) => {
    const existing = acc.find(
      (r) => r.recommendationObjectId === rec.recommendationObjectId
    );
    if (!existing || rec.score > existing.score) {
      return acc
        .filter((r) => r.recommendationObjectId !== rec.recommendationObjectId)
        .concat(rec);
    }
    return acc;
  }, [] as typeof userRecommendations);

  // Sort recommendations based on user preference
  const sortedRecommendations = [...deduplicatedRecommendations].sort(
    (a, b) => {
      if (sortBy === "overall") {
        return b.score - a.score; // Default: by overall score
      }

      const aMetadata = a.metadata as any;
      const bMetadata = b.metadata as any;

      if (sortBy === "goals") {
        return (bMetadata?.planSimScore || 0) - (aMetadata?.planSimScore || 0);
      }

      if (sortBy === "location") {
        return (bMetadata?.geoSimScore || 0) - (aMetadata?.geoSimScore || 0);
      }

      if (sortBy === "age") {
        return (bMetadata?.ageSimScore || 0) - (aMetadata?.ageSimScore || 0);
      }

      return 0;
    }
  );

  const getConnectionStatus = (
    userId: string
  ): "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED" | null => {
    if (!currentUser) return null;

    const connectionFrom = currentUser.connectionsFrom?.find(
      (conn) => conn.toId === userId
    );
    if (connectionFrom) return connectionFrom.status as any;

    const connectionTo = currentUser.connectionsTo?.find(
      (conn) => conn.fromId === userId
    );
    if (connectionTo) return connectionTo.status as any;

    return null;
  };

  const handleSendFriendRequest = async (userId: string | undefined) => {
    if (!userId) return;
    await sendFriendRequest(userId);
    setSentRequests((prev) => new Set(prev).add(userId));
  };

  if (isLoadingRecommendations) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const selectedRecommendation = sortedRecommendations.find(
    (rec) => rec.recommendationObjectId === selectedExplainer
  );

  // Get the current user's plan for the selected recommendation
  const selectedRecommendationPlan =
    selectedRecommendation &&
    typeof selectedRecommendation.metadata === "object" &&
    selectedRecommendation.metadata !== null
      ? currentUserPlans?.find(
          (p) =>
            p.id === (selectedRecommendation.metadata as any).relativeToPlanId
        )
      : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Sort Controls */}
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <div>
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setSortBy("overall")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                sortBy === "overall"
                  ? `${variants.bg} text-white`
                  : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              Overall
            </button>
            <button
              onClick={() => setSortBy("goals")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                sortBy === "goals"
                  ? `${variants.bg} text-white`
                  : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              🎯 Goals
            </button>
            <button
              onClick={() => setSortBy("location")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                sortBy === "location"
                  ? `${variants.bg} text-white`
                  : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              🌍 Location
            </button>
            <button
              onClick={() => setSortBy("age")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                sortBy === "age"
                  ? `${variants.bg} text-white`
                  : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              👥 Age
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sortedRecommendations.map((recommendation) => {
              const user = recommendedUsers.find(
                (user) => user.id === recommendation.recommendationObjectId
              );
              if (!user || !user.id) {
                return null;
              }
              const userPlans =
                recommendedPlans?.filter((plan) => plan.userId === user.id) ||
                [];
              // Find coached plan, or fallback to newest plan
              const plan =
                userPlans.find((p: any) => p.isCoached) ||
                userPlans.sort((a, b) => {
                  return (
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                  );
                })[0];

              const score = recommendation.score;
              const connectionStatus = getConnectionStatus(user.id);
              const hasSentRequest = sentRequests.has(user.id);

              return (
                <div
                  key={user.id}
                  className="bg-card rounded-2xl border border-border hover:shadow-lg transition-all relative cursor-pointer"
                  onClick={() => navigate({ to: `/profile/${user.username}` })}
                >
                  {/* Header with icons - Avatar + Plan Emoji */}
                  <div className="flex items-center justify-between p-6 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl flex-shrink-0">
                        {user.picture ? (
                          <img
                            src={user.picture}
                            alt={user.username || ""}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          user.name?.[0] || "U"
                        )}
                      </div>
                      {plan && <span className="text-4xl">{plan.emoji}</span>}
                    </div>

                    {/* Action buttons group */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedExplainer(user.id || null);
                        }}
                        className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                          score >= 0.5
                            ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-500 hover:bg-green-200"
                            : score >= 0.25
                            ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-800 hover:bg-yellow-200 dark:text-yellow-400 dark:hover:bg-yellow-800"
                            : "bg-red-100 dark:bg-red-950 text-red-800 hover:bg-red-200 dark:text-red-400 dark:hover:bg-red-800"
                        }`}
                      >
                        {Math.round(score * 100)}% match
                        <Info size={14} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendFriendRequest(user.id);
                        }}
                        disabled={
                          isSendingFriendRequest ||
                          hasSentRequest ||
                          connectionStatus === "PENDING" ||
                          connectionStatus === "ACCEPTED"
                        }
                        className="p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          hasSentRequest || connectionStatus === "PENDING"
                            ? "Request Sent"
                            : connectionStatus === "ACCEPTED"
                            ? "Friends"
                            : "Add Friend"
                        }
                      >
                        {hasSentRequest ||
                        connectionStatus === "PENDING" ||
                        connectionStatus === "ACCEPTED" ? (
                          <UserCheck className="h-6 w-6 text-green-600" />
                        ) : (
                          <UserPlus className="h-6 w-6 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Card content */}
                  <div className="px-6 pb-6">
                    <h3 className="text-xl font-semibold mb-1">
                      {user.name || user.username}
                    </h3>

                    {plan && (
                      <p className="text-sm text-muted-foreground">
                        {plan.goal}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <MatchScoreExplainer
        open={!!selectedExplainer}
        onClose={() => setSelectedExplainer(null)}
        recommendedUser={
          selectedRecommendation
            ? (recommendedUsers.find(
                (u) => u.id === selectedRecommendation.recommendationObjectId
              ) as {
                id: string;
                name: string;
                username: string;
                picture: string;
              } | null)
            : null
        }
        score={selectedRecommendation?.score || 0}
        currentUserPlan={
          selectedRecommendationPlan
            ? {
                goal: selectedRecommendationPlan.goal,
                emoji: selectedRecommendationPlan.emoji,
              }
            : null
        }
        recommendedUserPlan={
          selectedRecommendation
            ? (() => {
                const user = recommendedUsers.find(
                  (u) => u.id === selectedRecommendation.recommendationObjectId
                );
                if (!user?.id) return null;

                const userPlans =
                  recommendedPlans?.filter((plan) => plan.userId === user.id) ||
                  [];
                // Find coached plan, or fallback to newest plan
                const plan =
                  userPlans.find((p: any) => p.isCoached) ||
                  userPlans.sort((a, b) => {
                    return (
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                    );
                  })[0];

                return plan ? { goal: plan.goal, emoji: plan.emoji } : null;
              })()
            : null
        }
        metadata={
          selectedRecommendation?.metadata &&
          typeof selectedRecommendation.metadata === "object"
            ? (selectedRecommendation.metadata as any)
            : undefined
        }
      />
    </>
  );
};
