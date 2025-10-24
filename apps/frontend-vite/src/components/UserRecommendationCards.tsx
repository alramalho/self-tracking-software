import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { UserPlus, UserCheck, Info, Minus, X } from "lucide-react";
import { useCurrentUser } from "@/contexts/users";
import { MatchScoreExplainer } from "@/components/MatchScoreExplainer";

interface UserRecommendation {
  userId: string;
  username: string;
  name: string | null;
  picture: string | null;
  planGoal: string | null;
  planEmoji: string | null;
  score: number;
  matchReasons: string[];
  relativeToPlan?: {
    id: string;
    goal: string;
    emoji: string | null;
  } | null;
  metadata?: {
    planSimScore?: number;
    planSimWeight?: number;
    geoSimScore?: number;
    geoSimWeight?: number;
    ageSimScore?: number;
    ageSimWeight?: number;
  };
}

interface UserRecommendationCardsProps {
  recommendations: UserRecommendation[];
}

export const UserRecommendationCards: React.FC<
  UserRecommendationCardsProps
> = ({ recommendations }) => {
  const navigate = useNavigate();
  const { sendFriendRequest, isSendingFriendRequest, currentUser } =
    useCurrentUser();
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [selectedExplainer, setSelectedExplainer] = useState<string | null>(
    null
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

  const handleSendFriendRequest = async (userId: string) => {
    try {
      await sendFriendRequest(userId);
      setSentRequests((prev) => new Set(prev).add(userId));
    } catch (error) {
      console.error("Failed to send friend request:", error);
    }
  };

  if (!recommendations || recommendations.length === 0) return null;

  const selectedRecommendation = recommendations.find(
    (rec) => rec.userId === selectedExplainer
  );

  return (
    <>
      <div className="flex gap-3 pb-2 scrollbar-thin mt-3 overflow-x-auto -mx-4 px-4">
        {recommendations.map((rec) => {
          const connectionStatus = getConnectionStatus(rec.userId);
          const hasSentRequest = sentRequests.has(rec.userId);
          const isDisabled =
            isSendingFriendRequest ||
            hasSentRequest ||
            connectionStatus === "PENDING" ||
            connectionStatus === "ACCEPTED";

          return (
            <div
              key={rec.userId}
              className="min-w-[200px] max-w-[200px] bg-card rounded-xl border border-border hover:shadow-md transition-all cursor-pointer p-4 flex-shrink-0 flex flex-col"
              onClick={() => navigate({ to: `/profile/${rec.username}` })}
            >
              {/* Header with avatar and plan emoji */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm flex-shrink-0">
                  {rec.picture ? (
                    <img
                      src={rec.picture}
                      alt={rec.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    rec.name?.[0] || rec.username?.[0] || "U"
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {rec.planEmoji && (
                    <span className="text-2xl">{rec.planEmoji}</span>
                  )}
                  {rec?.relativeToPlan?.emoji && (
                    <>
                      <X size={10} />
                      <span className="text-2xl">
                        {rec.relativeToPlan.emoji}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* User info */}
              <h4 className="font-semibold text-sm mb-1 truncate">
                {rec.name || rec.username}
              </h4>

              {rec.planGoal && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {rec.planGoal}
                </p>
              )}

              {/* Current user's plan context */}
              {/* {rec.relativeToPlan && (
              <div className="mb-2 text-xs bg-muted/50 rounded-md px-2 py-1.5 border border-border/50">
                <p className="text-muted-foreground font-medium mb-0.5">For your goal:</p>
                <div className="flex items-center gap-1">
                  {rec.relativeToPlan.emoji && <span className="text-sm">{rec.relativeToPlan.emoji}</span>}
                  <span className="truncate text-foreground">{rec.relativeToPlan.goal}</span>
                </div>
              </div>
            )} */}

              {/* Match reasons */}
              {rec.matchReasons && rec.matchReasons.length > 0 && (
                <div className="mb-3 flex-grow">
                  {rec.matchReasons.slice(0, 2).map((reason, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      • {reason}
                    </p>
                  ))}
                </div>
              )}

              {/* Spacer to push buttons to bottom */}
              {(!rec.matchReasons || rec.matchReasons.length === 0) && (
                <div className="flex-grow" />
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-auto">
                {/* See match button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedExplainer(rec.userId);
                  }}
                  className={`flex-1 text-xs font-medium px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    rec.score >= 0.5
                      ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900"
                      : "bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900"
                  }`}
                >
                  {Math.round(rec.score * 100)}%
                  <Info size={12} />
                </button>

                {/* Add friend button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendFriendRequest(rec.userId);
                  }}
                  disabled={isDisabled}
                  className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Match Score Explainer */}
      <MatchScoreExplainer
        open={!!selectedExplainer}
        onClose={() => setSelectedExplainer(null)}
        recommendedUser={selectedRecommendation ? {
          name: selectedRecommendation.name || "",
          username: selectedRecommendation.username || "",
          picture: selectedRecommendation.picture || "",
        } : null}
        score={selectedRecommendation?.score || 0}
        currentUserPlan={selectedRecommendation?.relativeToPlan || null}
        recommendedUserPlan={
          selectedRecommendation?.planGoal
            ? {
                goal: selectedRecommendation.planGoal,
                emoji: selectedRecommendation.planEmoji,
              }
            : null
        }
        metadata={selectedRecommendation?.metadata}
        matchReasons={selectedRecommendation?.matchReasons}
      />
    </>
  );
};
