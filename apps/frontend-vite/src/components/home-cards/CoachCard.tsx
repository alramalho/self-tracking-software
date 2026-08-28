import { useCurrentUser } from "@/contexts/users";
import {
  getCoachAvatar,
  getCoachPersonalityConfig,
} from "@/lib/coachPersonality";
import { useNavigate } from "@tanstack/react-router";
import { HomeCardShell } from "./HomeCardShell";

export const CoachCard = () => {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const avatar = getCoachAvatar(currentUser?.coachPersonality, "thinking");

  return (
    <HomeCardShell onClick={() => navigate({ to: "/message-ai" })}>
      <img
        src={avatar}
        alt={aiCoach.label}
        className="h-14 w-14 rounded-full object-contain"
      />
      <p className="text-lg font-semibold leading-tight text-foreground">
        Week recap available!
      </p>
    </HomeCardShell>
  );
};
