import { useMessages } from "@/contexts/messages";
import { useCurrentUser } from "@/contexts/users";
import {
  getCoachAvatar,
  getCoachPersonalityConfig,
} from "@/lib/coachPersonality";
import { pickHomeCoachNote } from "@tsw/prisma/home-todo";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight } from "lucide-react";

/** The latest weekly recap, only while it is unread and recent. */
export const CoachNote = () => {
  const { currentUser } = useCurrentUser();
  const { chats } = useMessages();
  const navigate = useNavigate();
  const chat = chats?.find(
    (chat) => chat.type === "COACH" && chat.latestCoachMessage
  );
  const note = pickHomeCoachNote({
    preview: chat?.latestCoachMessage,
    planType: currentUser?.planType,
    proactiveCoachingEnabled: currentUser?.proactiveCoachingEnabled,
    now: new Date(),
  });
  if (!note) return null;
  const coach = getCoachPersonalityConfig(currentUser?.coachPersonality);

  return (
    <button
      type="button"
      data-testid="home-coach-note"
      aria-label={`${coach.name}: ${note.text}`}
      onClick={() => navigate({ to: "/message-ai" })}
      className="flex w-full items-center gap-3 rounded-[20px] bg-card px-3.5 py-3 text-left transition-transform active:scale-[0.98]"
    >
      <img
        src={getCoachAvatar(currentUser?.coachPersonality)}
        alt=""
        className="h-10 w-10 shrink-0 object-contain"
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs text-muted-foreground">
          {coach.name} ·{" "}
          {formatDistanceToNow(note.createdAt, { addSuffix: true })}
        </p>
        <p className="line-clamp-2 text-[15px] leading-5 text-foreground">
          {note.text}
        </p>
      </div>
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
    </button>
  );
};
