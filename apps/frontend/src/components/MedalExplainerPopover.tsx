import AppleLikePopover from "@/components/AppleLikePopover";
import { ProgressBar } from "@/components/ProgressBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useActivities } from "@/contexts/activities";
import { useCurrentUser } from "@/contexts/users";
import { ACCOUNT_LEVELS, useAccountLevel } from "@/hooks/useAccountLevel";
import { Check, Medal, Target, Trophy, Zap } from "lucide-react";
import React from "react";

interface MedalExplainerPopoverProps {
  open: boolean;
  onClose: () => void;
}

const MedalExplainerPopover: React.FC<MedalExplainerPopoverProps> = ({
  open,
  onClose,
}) => {
  const { currentUser } = useCurrentUser();
  const { activityEntries } = useActivities();
  const totalActivitiesLogged = activityEntries?.length || 0;
  const accountLevel = useAccountLevel(totalActivitiesLogged);

  return (
    <AppleLikePopover open={open} onClose={onClose} title="Level Progress">
      <div className="p-6 space-y-6">
        {/* User Profile Header */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage
                src={currentUser?.picture || ""}
                alt={currentUser?.name || ""}
              />
              <AvatarFallback className="bg-muted">
                {currentUser?.name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            {accountLevel.currentLevel && accountLevel.atLeastBronze && (
              <div className="absolute -bottom-1 -right-1">
                <Medal
                  size={20}
                  className="text-muted-foreground"
                />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">
              {currentUser?.name}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground" style={{color: accountLevel.currentLevel?.color}}>
                {accountLevel.currentLevel?.name || "New"}
              </span>
              <span>•</span>
              <span>{totalActivitiesLogged} activities</span>
            </div>
          </div>
        </div>

        {/* Current Progress */}
        {!accountLevel.isMaxLevel && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-sm">
                <span className="text-muted-foreground">Next: </span>
                <span className="font-medium text-foreground" style={{color: accountLevel.nextLevel?.color}}>
                  {accountLevel.nextLevel?.name}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {Math.round(accountLevel.percentage)}%
              </Badge>
            </div>
            <ProgressBar
              current={
                totalActivitiesLogged -
                (accountLevel.currentLevel?.threshold || 0)
              }
              max={
                (accountLevel.nextLevel?.threshold || 0) -
                (accountLevel.currentLevel?.threshold || 0)
              }
              className="h-2"
              color={accountLevel.nextLevel?.color}
            />
            <p className="text-xs text-muted-foreground text-center">
              <span className="font-medium text-foreground">
                {accountLevel.activitiesForNextLevel}
              </span>{" "}
              more activities needed
            </p>
          </div>
        )}

        {accountLevel.isMaxLevel && (
          <div className="text-center space-y-2 py-4">
            <Trophy size={24} className="text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h3 className="font-medium text-foreground">Max Level Reached</h3>
              <p className="text-xs text-muted-foreground">
                You've unlocked all available levels
              </p>
            </div>
          </div>
        )}

        {/* Level Journey */}
        <div className="space-y-4">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Target size={16} className="text-muted-foreground" />
            All Levels
          </h3>

          <div className="space-y-2">
            {ACCOUNT_LEVELS.map((level) => {
              const isUnlocked = totalActivitiesLogged >= level.threshold;
              const isCurrent = accountLevel.currentLevel?.name === level.name;

              return (
                <div
                  key={level.name}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isCurrent
                      ? "border-border bg-muted/50"
                      : isUnlocked
                      ? "border-border/50 bg-background"
                      : "border-border/30 bg-muted/20 opacity-60"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                    <div className="w-4 h-4 text-muted-foreground">
                      {level.getIcon()}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        isUnlocked ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {level.name}
                      </span>
                      {isCurrent && (
                        <Badge variant="default" className="text-xs h-5">
                          Current
                        </Badge>
                      )}
                      {isUnlocked && !isCurrent && (
                        <Check size={24} className="text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {level.threshold === 0
                        ? "Starting level"
                        : `${level.threshold} activities required`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Motivational Message */}
        <div className="flex flex-row gap-3 items-center text-center py-4 border-t border-border">
          <Zap size={34} className="text-muted-foreground mx-auto" />
          <p className="text-sm text-left text-muted-foreground">
            Keep logging activities to unlock new levels, and claim rewards!
          </p>
        </div>
      </div>
    </AppleLikePopover>
  );
};

export default MedalExplainerPopover;