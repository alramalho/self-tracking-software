import { useCurrentUser } from "@/contexts/users";
import { getCoachAvatar, getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { useNavigate } from "@tanstack/react-router";
import { HomeCardShell } from "./HomeCardShell";

interface CoachCardProps {
  attentionCount: number;
  activePlanCount: number;
  reviewPlanId?: string;
}

export const CoachCard = ({
  attentionCount,
  activePlanCount,
  reviewPlanId,
}: CoachCardProps) => {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const hasActivePlans = activePlanCount > 0;
  const avatar = getCoachAvatar(
    currentUser?.coachPersonality,
    attentionCount > 0 ? "thinking" : hasActivePlans ? "coachSmiling" : "sad"
  );

  return (
    <HomeCardShell
      onClick={() => {
        if (attentionCount > 0 && reviewPlanId) {
          navigate({ to: `/plans?selectedPlan=${reviewPlanId}` });
          return;
        }
        navigate({ to: "/message-ai" });
      }}
    >
      <div className="relative w-12 h-12">
        {attentionCount > 0 && (
          <div className="absolute inset-0 rounded-full animate-ping bg-amber-400/30" />
        )}
        <img
          src={avatar}
          alt={aiCoach.label}
          className="w-12 h-12 rounded-full object-contain relative z-10"
        />
      </div>
      <p className="text-base font-medium text-muted-foreground">
        {attentionCount > 0
          ? `${attentionCount} coach action${attentionCount > 1 ? "s" : ""} pending`
          : hasActivePlans
          ? "No coach actions pending"
          : "No active plans"}
      </p>
    </HomeCardShell>
  );
};
