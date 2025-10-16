import AppleLikePopover from "@/components/AppleLikePopover";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendations } from "@/contexts/recommendations";
import { useCurrentUser } from "@/contexts/users";
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
  const sortedRecommendations = [...deduplicatedRecommendations].sort((a, b) => {
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
  });

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

  return (
    <>
      {/* Sort Controls */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
      <span className="text-sm text-muted-foreground mr-2">Sort by:</span>
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
          const plan = recommendedPlans
            ?.filter((plan) => plan.userId === user.id)
            .sort((a, b) => {
              if (a.sortOrder !== null && b.sortOrder !== null) {
                return a.sortOrder - b.sortOrder;
              }
              if (a.sortOrder !== null && b.sortOrder === null) return -1;
              if (a.sortOrder === null && b.sortOrder !== null) return 1;
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
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : score >= 0.25
                        ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                        : "bg-red-100 text-red-800 hover:bg-red-200"
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

      {/* Match Score Explainer Popover */}
      <AppleLikePopover
        open={!!selectedExplainer}
        onClose={() => setSelectedExplainer(null)}
        title="Match Score Breakdown"
      >
        {selectedRecommendation &&
          (() => {
            const selectedUser = recommendedUsers.find(
              (u) => u.id === selectedRecommendation.recommendationObjectId
            );

            return (
              <div className="p-4 space-y-4">
                {/* Avatar Header */}
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl flex-shrink-0 border-2 border-border">
                    {currentUser?.picture ? (
                      <img
                        src={currentUser.picture}
                        alt={currentUser.username || ""}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      currentUser?.name?.[0] || "U"
                    )}
                  </div>
                  <span className="text-2xl font-bold text-muted-foreground">×</span>
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl flex-shrink-0 border-2 border-border">
                    {selectedUser?.picture ? (
                      <img
                        src={selectedUser.picture}
                        alt={selectedUser.username || ""}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      selectedUser?.name?.[0] || "U"
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  How well you match across different dimensions:
                </p>
                <div className="space-y-3">
                  {typeof selectedRecommendation.metadata === "object" &&
                  selectedRecommendation.metadata !== null ? (
                    <>
                      {"planSimScore" in selectedRecommendation.metadata &&
                        (selectedRecommendation.metadata as any)
                          .planSimScore !== undefined && (
                          <ScoreItem
                            emoji="🎯"
                            label="Goals Similarity"
                            score={
                              (selectedRecommendation.metadata as any)
                                .planSimScore || 0
                            }
                            weight={
                              (selectedRecommendation.metadata as any)
                                .planSimWeight || 0.6
                            }
                          />
                        )}
                      {"geoSimScore" in selectedRecommendation.metadata &&
                        (selectedRecommendation.metadata as any).geoSimScore !==
                          undefined && (
                          <ScoreItem
                            emoji="🌍"
                            label="Location"
                            score={
                              (selectedRecommendation.metadata as any)
                                .geoSimScore || 0
                            }
                            weight={
                              (selectedRecommendation.metadata as any)
                                .geoSimWeight || 0.2
                            }
                          />
                        )}
                      {"ageSimScore" in selectedRecommendation.metadata &&
                        (selectedRecommendation.metadata as any).ageSimScore !==
                          undefined && (
                          <ScoreItem
                            emoji="👥"
                            label="Age"
                            score={
                              (selectedRecommendation.metadata as any)
                                .ageSimScore || 0
                            }
                            weight={
                              (selectedRecommendation.metadata as any)
                                .ageSimWeight || 0.2
                            }
                          />
                        )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No detailed score breakdown available
                    </p>
                  )}
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Total Match
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {Math.round(selectedRecommendation.score * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
      </AppleLikePopover>
    </>
  );
};

const ScoreItem: React.FC<{
  emoji: string;
  label: string;
  score: number;
  weight: number;
}> = ({ emoji, label, score, weight }) => {
  const getScoreColor = (score: number) => {
    if (score >= 0.6) return "text-green-600";
    if (score >= 0.2) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 0.6) return "bg-green-50 border-green-200";
    if (score >= 0.2) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 0.6) return "bg-green-500";
    if (score >= 0.2) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className={`p-4 rounded-xl border ${getScoreBgColor(score)}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <span className="font-semibold text-foreground">{label}</span>
        </div>
        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
          {Math.round(score * 100)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all ${getProgressBarColor(
            score
          )}`}
          style={{ width: `${score * 100}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>Importance: {Math.round(weight * 100)}%</span>
        <span>Contributes {Math.round(score * weight * 100)}% to total</span>
      </div>
    </div>
  );
};
