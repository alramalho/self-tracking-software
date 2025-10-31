import AppleLikePopover from "@/components/AppleLikePopover";
// ACHIEVEMENT_WEEKS moved to backend
import { type PlanProgressData } from "@/contexts/plans-progress";
import useConfetti from "@/hooks/useConfetti";
import { Flame, Medal, Sprout } from "lucide-react";
import React, { useEffect, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface BadgeExplainerPopoverProps {
  open: boolean;
  onClose: () => void;
  user: {
    name: string;
    picture: string;
    username: string;
  };
  planIds: string[];
  badgeType: "streaks" | "habits" | "lifestyles" | null;
  userId?: string; // Optional user ID for viewing other users' achievements
  userPlansProgressData: PlanProgressData[];
}

const BadgeExplainerPopover: React.FC<BadgeExplainerPopoverProps> = ({
  open,
  onClose,
  user,
  planIds,
  badgeType,
  userId,
  userPlansProgressData: plansProgressData,
}) => {
  const { stars, shapes } = useConfetti();

  // Filter achievements based on badge type
  const relevantAchievements = useMemo(() => {
    if (!plansProgressData || !badgeType) return [];

    return plansProgressData.filter((progress) => {
      switch (badgeType) {
        case "habits":
          return progress.habitAchievement?.isAchieved;
        case "lifestyles":
          return progress.lifestyleAchievement?.isAchieved;
        case "streaks":
          return progress.achievement?.streak > 0;
        default:
          return false;
      }
    });
  }, [plansProgressData, badgeType]);

  // Get the first achievement for the celebration display
  const firstAchievement = relevantAchievements[0];

  useEffect(() => {
    if (
      open &&
      badgeType &&
      ["habits", "lifestyles"].includes(badgeType) &&
      relevantAchievements.length > 0
    ) {
      setTimeout(() => {
        stars();
        shapes();
      }, 500);
    }
  }, [badgeType, open, relevantAchievements.length, stars, shapes]);

  return (
    <AppleLikePopover open={open} onClose={onClose} title="Badge Details">
      <div className="p-4">
        <>
          {/* Achievement celebration section */}
          {badgeType &&
            ["habits", "lifestyles"].includes(badgeType) &&
            firstAchievement &&
            user && (
              <div
                className={`bg-gradient-to-br ${
                  badgeType === "lifestyles"
                    ? "from-amber-50 to-amber-100 dark:from-amber-900 dark:to-amber-800"
                    : "from-lime-50 to-lime-100 dark:from-lime-900 dark:to-lime-800"
                } rounded-lg p-6 text-center mb-6`}
              >
                <div className="flex justify-center items-center mb-4">
                  <Avatar
                    className={`h-16 w-16 border-4 ${
                      badgeType === "lifestyles"
                        ? "border-amber-200"
                        : "border-lime-200"
                    }`}
                  >
                    <AvatarImage src={user?.picture || ""} />
                    <AvatarFallback>{(user?.name || "U")[0]}</AvatarFallback>
                  </Avatar>
                  {badgeType === "lifestyles" && (
                    <Medal size={52} className="text-amber-500 animate-pulse" />
                  )}
                  {badgeType === "habits" && (
                    <Sprout size={52} className="text-lime-500 animate-pulse" />
                  )}
                </div>
                <div className="space-y-2">
                  <h3
                    className={`text-xl font-bold ${
                      badgeType === "lifestyles"
                        ? "text-amber-900"
                        : "text-lime-900"
                    }`}
                  >
                    {user?.name} achieved{" "}
                    {relevantAchievements.length > 1
                      ? `${relevantAchievements.length} `
                      : "a "}
                    {badgeType.slice(0, -1)} badge
                    {relevantAchievements.length > 1 ? "s" : ""}! 🎉
                  </h3>
                  {relevantAchievements.length === 1 && (
                    <>
                      <p
                        className={
                          badgeType === "lifestyles"
                            ? "text-amber-800"
                            : "text-lime-800"
                        }
                      >
                        By maintaining a
                        <span className="font-bold">
                          {" "}
                          {firstAchievement.achievement.streak}-week streak{" "}
                        </span>
                        on the plan
                      </p>
                      <p className="text-lg">
                        <span className="text-2xl">
                          {firstAchievement.plan.emoji}
                        </span>{" "}
                        {firstAchievement.plan.goal}
                      </p>
                    </>
                  )}
                  {relevantAchievements.length > 1 && (
                    <p
                      className={
                        badgeType === "lifestyles"
                          ? "text-amber-800"
                          : "text-lime-800"
                      }
                    >
                      Across {relevantAchievements.length} different plans!
                    </p>
                  )}
                </div>
              </div>
            )}

          {/* Show all relevant achievements */}
          {relevantAchievements.length > 1 && (
            <div className="space-y-3 mb-6">
              <h4 className="font-semibold text-foreground">
                {user?.name} Achievements:
              </h4>
              {relevantAchievements.map((achievement, index) => (
                <div
                  key={achievement.plan.id}
                  className="p-3 border rounded-lg bg-card/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{achievement.plan.emoji}</span>
                    <h5 className="font-medium">{achievement.plan.goal}</h5>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {badgeType === "streaks" && (
                      <p>
                        Current streak:{" "}
                        <span className="font-bold">
                          {achievement.achievement.streak}
                        </span>{" "}
                        weeks
                      </p>
                    )}
                    {badgeType === "habits" && (
                      <p>
                        Habit achieved with{" "}
                        <span className="font-bold">
                          {achievement.achievement.streak}
                        </span>{" "}
                        week streak
                      </p>
                    )}
                    {badgeType === "lifestyles" && (
                      <p>
                        Lifestyle achieved with{" "}
                        <span className="font-bold">
                          {achievement.achievement.streak}
                        </span>{" "}
                        week streak
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
        <h3 className="text-xl font-semibold mb-4 mt-6">
          🏆 How badges are earned
        </h3>

        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Flame className="text-red-500 inline-block" size={24} /> Streaks:
          </h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              • Each completed week adds <span className="font-bold">+1</span>{" "}
              to your streak
            </li>
            <li>
              • Each incomplete week subtracts{" "}
              <span className="font-bold">-1</span> from your streak
            </li>
            <li>
              • You have a <span className="font-bold">1 week buffer</span>{" "}
              before it starts subtracting
            </li>
            <li>
              • Streak score cannot go below{" "}
              <span className="font-bold">0</span>
            </li>
          </ul>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Sprout className="text-lime-500 inline-block" size={24} /> Habit
            badge:
          </h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• You get a habit badge if you achieve a streak of 4 weeks!</li>
          </ul>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Medal className="text-yellow-500 inline-block" size={24} />{" "}
            Lifestyle badge:
          </h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              • You get a lifetyle badge if you achieve a streak of 9 weeks!
            </li>
          </ul>
        </div>

        {/* <div className="space-y-4">
          {profileData?.plans?.map((plan) => {
            const progressData = plansProgress.find(
              (p) => p.plan.id === plan.id
            );

            if (!progressData) {
              return null;
            }

            const { streak, completedWeeks, incompleteWeeks } =
              progressData.achievement;

            if (
              streak === 0 &&
              completedWeeks === 0 &&
              incompleteWeeks === 0 &&
              !activityEntries.some((entry) =>
                plan.activityIds?.includes(entry.activityId)
              )
            ) {
              return null;
            }

            return (
              <div key={plan.id} className="p-4 border rounded-lg bg-white/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{plan.emoji}</span>
                  <h4 className="font-medium">{plan.goal}</h4>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    • Total Completed weeks:{" "}
                    <span className="font-bold">{completedWeeks}</span>
                  </p>
                  <p>
                    • Incomplete weeks since last streak:{" "}
                    <span className="font-bold">{incompleteWeeks}</span>
                  </p>
                  <p>
                    • Current streak score:{" "}
                    <span className="font-bold">{streak}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div> */}
      </div>
    </AppleLikePopover>
  );
};

export default BadgeExplainerPopover;
