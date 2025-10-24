import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { UserPlus, UserCheck, Info } from "lucide-react";
import { useCurrentUser } from "@/contexts/users";
import AppleLikePopover from "@/components/AppleLikePopover";

interface UserRecommendation {
  userId: string;
  username: string;
  name: string | null;
  picture: string | null;
  planGoal: string | null;
  planEmoji: string | null;
  score: number;
  matchReasons: string[];
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
            className="min-w-[200px] max-w-[200px] bg-card rounded-xl border border-border hover:shadow-md transition-all cursor-pointer p-4 flex-shrink-0"
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
              {rec.planEmoji && <span className="text-2xl">{rec.planEmoji}</span>}
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

            {/* Match reasons */}
            {rec.matchReasons && rec.matchReasons.length > 0 && (
              <div className="mb-3">
                {rec.matchReasons.slice(0, 2).map((reason, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    • {reason}
                  </p>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
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

      {/* Match Score Explainer Popover */}
      <AppleLikePopover
        open={!!selectedExplainer}
        onClose={() => setSelectedExplainer(null)}
        title="Match Score Breakdown"
      >
        {selectedRecommendation && (
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
                {selectedRecommendation.picture ? (
                  <img
                    src={selectedRecommendation.picture}
                    alt={selectedRecommendation.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  selectedRecommendation.name?.[0] ||
                  selectedRecommendation.username?.[0] ||
                  "U"
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center mb-6">
              How well you match across different dimensions:
            </p>
            <div className="space-y-3">
              {selectedRecommendation.metadata ? (
                <>
                  {selectedRecommendation.metadata.planSimScore !== undefined && (
                    <ScoreItem
                      emoji="🎯"
                      label="Goals Similarity"
                      score={selectedRecommendation.metadata.planSimScore}
                      weight={selectedRecommendation.metadata.planSimWeight || 0.6}
                    />
                  )}
                  {selectedRecommendation.metadata.geoSimScore !== undefined && (
                    <ScoreItem
                      emoji="🌍"
                      label="Location"
                      score={selectedRecommendation.metadata.geoSimScore}
                      weight={selectedRecommendation.metadata.geoSimWeight || 0.2}
                    />
                  )}
                  {selectedRecommendation.metadata.ageSimScore !== undefined && (
                    <ScoreItem
                      emoji="👥"
                      label="Age"
                      score={selectedRecommendation.metadata.ageSimScore}
                      weight={selectedRecommendation.metadata.ageSimWeight || 0.2}
                    />
                  )}
                </>
              ) : selectedRecommendation.matchReasons &&
                selectedRecommendation.matchReasons.length > 0 ? (
                selectedRecommendation.matchReasons.map((reason, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-muted border border-border"
                  >
                    <p className="text-sm text-foreground">• {reason}</p>
                  </div>
                ))
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
                  {Math.round(selectedRecommendation.score)}%
                </span>
              </div>
            </div>
          </div>
        )}
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
    if (score >= 0.6) return "text-green-600 dark:text-green-400";
    if (score >= 0.2) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 0.6) return "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800";
    if (score >= 0.2) return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800";
    return "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800";
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
