import AppleLikePopover from "@/components/AppleLikePopover";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendations } from "@/contexts/recommendations";
import { useCurrentUser } from "@/contexts/users";
import { useNavigate } from "@tanstack/react-router";
import { Info, UserCheck, UserPlus } from "lucide-react";
import React, { useState } from "react";

interface RecommendedUsersProps {
  selectedPlanId: string | null;
}

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

  const selectedRecommendation = deduplicatedRecommendations.find(
    (rec) => rec.recommendationObjectId === selectedExplainer
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {deduplicatedRecommendations.map((recommendation) => {
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
              className="bg-white/50 p-6 rounded-2xl border border-gray-200 hover:shadow-lg transition-all relative"
            >
              <div
                className="flex items-start justify-between mb-4 cursor-pointer"
                onClick={() => navigate({ to: `/profile/${user.username}` })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-xl flex-shrink-0">
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
                  <div>
                    <h3 className="font-semibold">
                      {user.name || user.username}
                    </h3>
                    <p className="text-sm text-gray-600">@{user.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedExplainer(user.id || null);
                    }}
                    className="bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-blue-200 transition-colors flex items-center gap-1.5"
                  >
                    {Math.round(score * 100)}% match
                    <Info size={12} />
                  </button>
                </div>
              </div>
              {plan && (
                <div
                  className="text-sm text-gray-700 mb-4 cursor-pointer"
                  onClick={() => navigate({ to: `/profile/${user.username}` })}
                >
                  <span className="mr-2">{plan.emoji}</span>
                  {plan.goal}
                </div>
              )}
              <div className="flex justify-center">
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
                  className="px-4 py-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-gray-200"
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
                    <UserCheck className="h-5 w-5 text-green-600" />
                  ) : (
                    <>
                      <span className="text-sm">Add Friend</span>
                      <UserPlus className="h-5 w-5 text-gray-600" />
                    </>
                  )}
                </button>
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
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl flex-shrink-0 border-2 border-gray-300">
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
                  <span className="text-2xl font-bold text-gray-400">×</span>
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl flex-shrink-0 border-2 border-gray-300">
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
                <p className="text-sm text-gray-600 text-center mb-6">
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
                                .planSimWeight || 0.4
                            }
                          />
                        )}
                      {"activityConsistencyScore" in
                        selectedRecommendation.metadata &&
                        (selectedRecommendation.metadata as any)
                          .activityConsistencyScore !== undefined && (
                          <ScoreItem
                            emoji="🔥"
                            label="Activity Level"
                            score={
                              (selectedRecommendation.metadata as any)
                                .activityConsistencyScore || 0
                            }
                            weight={
                              (selectedRecommendation.metadata as any)
                                .activityConsistencyWeight || 0.25
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
                                .ageSimWeight || 0.15
                            }
                          />
                        )}
                      {/* Fallback for old recommendations with recentActivityScore */}
                      {!(
                        "activityConsistencyScore" in
                        selectedRecommendation.metadata
                      ) &&
                        "recentActivityScore" in
                          selectedRecommendation.metadata &&
                        (selectedRecommendation.metadata as any)
                          .recentActivityScore !== undefined && (
                          <ScoreItem
                            emoji="⏱️"
                            label="Recent Activity"
                            score={
                              (selectedRecommendation.metadata as any)
                                .recentActivityScore || 0
                            }
                            weight={
                              (selectedRecommendation.metadata as any)
                                .recentActivityWeight || 0.33
                            }
                          />
                        )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No detailed score breakdown available
                    </p>
                  )}
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
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
          <span className="font-semibold text-gray-900">{label}</span>
        </div>
        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
          {Math.round(score * 100)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all ${getProgressBarColor(
            score
          )}`}
          style={{ width: `${score * 100}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>Importance: {Math.round(weight * 100)}%</span>
        <span>Contributes {Math.round(score * weight * 100)}% to total</span>
      </div>
    </div>
  );
};
