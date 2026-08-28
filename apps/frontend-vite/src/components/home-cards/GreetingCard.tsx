import { useCurrentUser } from "@/contexts/users";
import { useNavigate } from "@tanstack/react-router";
import {
  COACH_CONVERSATION_STARTER_IDS,
  getCoachConversationStarter,
} from "@tsw/prisma/coach-conversation-starters";
import { useState } from "react";

export const GreetingCard = () => {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();

  const firstName =
    currentUser?.name?.split(" ")[0] || currentUser?.username || "there";
  const [starterId] = useState(
    () =>
      COACH_CONVERSATION_STARTER_IDS[
        Math.floor(Math.random() * COACH_CONVERSATION_STARTER_IDS.length)
      ],
  );
  const message = getCoachConversationStarter(starterId, firstName);

  return (
    <div
      onClick={() =>
        navigate({ to: "/message-ai", search: { coachStarter: starterId } })
      }
      className="aspect-square flex flex-col justify-end p-4 cursor-pointer active:scale-[0.97] transition-all duration-200"
    >
      <p className="text-lg font-semibold leading-tight text-foreground">
        {message}
      </p>
    </div>
  );
};
