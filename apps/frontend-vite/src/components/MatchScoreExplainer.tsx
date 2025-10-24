import AppleLikePopover from "@/components/AppleLikePopover";
import { useCurrentUser } from "@/contexts/users";
import React from "react";

interface MatchScoreExplainerProps {
  open: boolean;
  onClose: () => void;
  recommendedUser: {
    picture?: string;
    username?: string;
    name?: string;
  } | null;
  score: number;
  currentUserPlan?: {
    goal: string;
    emoji: string | null;
  } | null;
  recommendedUserPlan?: {
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
  matchReasons?: string[];
}

export const MatchScoreExplainer: React.FC<MatchScoreExplainerProps> = ({
  open,
  onClose,
  recommendedUser,
  score,
  currentUserPlan,
  recommendedUserPlan,
  metadata,
  matchReasons,
}) => {
  const { currentUser } = useCurrentUser();
  return (
    <AppleLikePopover
      open={open}
      onClose={onClose}
      title="Match Score Breakdown"
    >
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
            {recommendedUser?.picture ? (
              <img
                src={recommendedUser.picture}
                alt={recommendedUser.username || ""}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              recommendedUser?.name?.[0] || "U"
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center mb-6">
          How well you match across different dimensions:
        </p>

        {/* Plan Match Context */}
        {(currentUserPlan || recommendedUserPlan) && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground font-medium mb-2">This match is for:</p>
            <div className="space-y-2">
              {currentUserPlan && (
                <div className="flex items-center gap-2">
                  {currentUserPlan.emoji && <span className="text-lg">{currentUserPlan.emoji}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Your goal:</p>
                    <p className="text-sm font-medium truncate">{currentUserPlan.goal}</p>
                  </div>
                </div>
              )}
              {recommendedUserPlan && (
                <div className="flex items-center gap-2">
                  {recommendedUserPlan.emoji && <span className="text-lg">{recommendedUserPlan.emoji}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Their goal:</p>
                    <p className="text-sm font-medium truncate">{recommendedUserPlan.goal}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {metadata ? (
            <>
              {metadata.planSimScore !== undefined && (
                <ScoreItem
                  emoji="🎯"
                  label="Goals Similarity"
                  score={metadata.planSimScore}
                  weight={metadata.planSimWeight || 0.6}
                />
              )}
              {metadata.geoSimScore !== undefined && (
                <ScoreItem
                  emoji="🌍"
                  label="Location"
                  score={metadata.geoSimScore}
                  weight={metadata.geoSimWeight || 0.2}
                />
              )}
              {metadata.ageSimScore !== undefined && (
                <ScoreItem
                  emoji="👥"
                  label="Age"
                  score={metadata.ageSimScore}
                  weight={metadata.ageSimWeight || 0.2}
                />
              )}
            </>
          ) : matchReasons && matchReasons.length > 0 ? (
            matchReasons.map((reason, i) => (
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
            <span className="font-semibold text-foreground">Total Match</span>
            <span className="text-lg font-bold">
              {Math.round(score * 100)}%
            </span>
          </div>
        </div>
      </div>
    </AppleLikePopover>
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
    if (score >= 0.6)
      return "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800";
    if (score >= 0.2)
      return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800";
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
