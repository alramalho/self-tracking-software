import AppleLikePopover from "@/components/AppleLikePopover";
// ACHIEVEMENT_WEEKS moved to backend
import useConfetti from "@/hooks/useConfetti";
import { Flame, Medal, Sprout } from "lucide-react";
import React, { useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface BadgeExplainerPopoverProps {
  open: boolean;
  onClose: () => void;
  achiever?: {
    user: {
      username: string;
      name: string;
      picture: string;
    };
    plan: {
      type: "habit" | "lifestyle" | undefined;
      emoji: string;
      goal: string;
      streak: number;
    };
  };
}

const BadgeExplainerPopover: React.FC<BadgeExplainerPopoverProps> = ({
  open,
  onClose,
  achiever,
}) => {
  const { stars, shapes } = useConfetti();
  
  useEffect(() => {
    if (open && achiever?.plan.type && ["habit", "lifestyle"].includes(achiever.plan.type)) {
      setTimeout(() => {
        stars()
        shapes()
      }, 500)
    }
  }, [achiever, open]);

  return (
    <AppleLikePopover open={open} onClose={onClose} title="Streak Details">
      <div className="p-4">
        {achiever &&
          achiever.plan.type &&
          ["habit", "lifestyle"].includes(achiever.plan.type) && (
            <div className={`bg-gradient-to-br ${achiever.plan.type === 'lifestyle' ? 'from-amber-50 to-amber-100' : 'from-lime-50 to-lime-100'} rounded-lg p-6 text-center`}>
              <div className="flex justify-center items-center mb-4">
                <Avatar className={`h-16 w-16 border-4 ${achiever.plan.type === 'lifestyle' ? 'border-amber-200' : 'border-lime-200'}`}>
                  <AvatarImage src={achiever?.user.picture} />
                  <AvatarFallback>{achiever?.user.name[0]}</AvatarFallback>
                </Avatar>
                {achiever.plan.type === "lifestyle" && (
                  <Medal size={52} className="text-amber-500 animate-pulse" />
                )}
                {achiever.plan.type === "habit" && (
                  <Sprout size={52} className="text-lime-500 animate-pulse" />
                )}
              </div>
              <div className="space-y-2">
                <h3 className={`text-xl font-bold ${achiever.plan.type === 'lifestyle' ? 'text-amber-900' : 'text-lime-900'}`}>
                  {achiever?.user.name} achieved a {achiever.plan.type} badge! 🎉
                </h3>
                <p className={achiever.plan.type === 'lifestyle' ? 'text-amber-800' : 'text-lime-800'}>
                  By maintaining a
                  <span className="font-bold">
                    {" "}
                    {achiever.plan.streak}-week streak{" "}
                  </span>
                  on the plan
                </p>
                <p className="text-lg">
                  <span className="text-2xl">{achiever.plan.emoji}</span> {achiever.plan.goal}
                </p>
              </div>
            </div>
          )}
        <h3 className="text-xl font-semibold mb-4 mt-6">🏆 How badges are earned</h3>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Flame className="text-red-500 inline-block" size={24} /> Streaks:
          </h4>
          <ul className="text-sm text-gray-600 space-y-2">
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

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Sprout className="text-lime-500 inline-block" size={24} /> Habit
            badge:
          </h4>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• You get a habit badge if you achieve a streak of 4 weeks!</li>
          </ul>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Medal className="text-yellow-500 inline-block" size={24} />{" "}
            Lifestyle badge:
          </h4>
          <ul className="text-sm text-gray-600 space-y-2">
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
