import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getCoachAvatar, getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { ChevronRight } from "lucide-react";
import { HomeCardShell } from "./HomeCardShell";

type CoachUpgradeCardProps = {
  onOpenUpgrade: () => void;
  recentActivityCount: number;
};

function activityCountCopy(count: number) {
  if (count === 0) return "The past 30 days were quiet.";
  if (count === 1) return "You logged 1 activity in 30 days.";
  return `You logged ${count} activities in 30 days.`;
}

export const CoachUpgradeCard = ({
  onOpenUpgrade,
  recentActivityCount,
}: CoachUpgradeCardProps) => {
  const { currentUser } = useCurrentUser();
  const themeColors = useThemeColors();
  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const avatar = getCoachAvatar(currentUser?.coachPersonality, "sad");

  return (
    <HomeCardShell
      onClick={onOpenUpgrade}
      className="aspect-[2/1] overflow-hidden border p-5 ring-0"
      style={{
        background: `linear-gradient(135deg, ${themeColors.hex}1F 0%, rgba(24, 24, 27, 0.42) 58%, ${themeColors.hex}12 100%)`,
        borderColor: `${themeColors.hex}55`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <img
            src={avatar}
            alt={aiCoach.label}
            className="h-20 w-20 rounded-full object-contain"
          />
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
      </div>

      <div>
        <p className="text-xl font-semibold leading-tight text-foreground">
          {activityCountCopy(recentActivityCount)}
        </p>
        <p className="mt-1 text-sm font-medium leading-snug text-muted-foreground">
          A coach can help you restart with a smaller next step.
        </p>
        <p className={`mt-3 inline-flex items-center text-sm font-semibold ${themeColors.text}`}>
          Try coach
          <ChevronRight className="ml-1 h-4 w-4" />
        </p>
      </div>
    </HomeCardShell>
  );
};
