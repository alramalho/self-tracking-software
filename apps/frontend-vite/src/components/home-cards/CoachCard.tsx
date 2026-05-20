import { useCurrentUser } from "@/contexts/users";
import { getCoachAvatar, getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { useNavigate } from "@tanstack/react-router";
import { HomeCardShell } from "./HomeCardShell";

interface CoachCardProps {
  attentionCount: number;
}

export const CoachCard = ({ attentionCount }: CoachCardProps) => {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const avatar = getCoachAvatar(
    currentUser?.coachPersonality,
    attentionCount > 0 ? "thinking" : "coachSmiling"
  );

  return (
    <HomeCardShell onClick={() => navigate({ to: "/message-ai" })}>
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
          ? `${attentionCount} plan${attentionCount > 1 ? "s" : ""} need attention`
          : "All plans on track"}
      </p>
    </HomeCardShell>
  );
};
