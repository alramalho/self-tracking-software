import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { pickCoachNote } from "@tsw/prisma/home-todo";
import { CoachItemDrawer } from "@/components/coach/CoachItemDrawer";
import { coachFace } from "@/components/coach/face";
import { useCoachInbox } from "@/components/coach/useCoachInbox";
import type { CoachItem } from "@/components/coach/types";
import { useCurrentUser } from "@/contexts/users";

/** The one Coach tab item worth a note on the homepage; most days there is none. Same as the iPhone app. */
export const CoachNote = () => {
  const { currentUser } = useCurrentUser();
  const inbox = useCoachInbox();
  const [open, setOpen] = useState<CoachItem>();
  const note = pickCoachNote(inbox.items);
  if (!note) return null;
  return (
    <>
      <button
        type="button"
        data-testid="home-coach-note"
        aria-label={`${note.title}. ${note.label}`}
        onClick={() => setOpen(note)}
        className="flex w-full items-center gap-3 rounded-[20px] bg-card px-3.5 py-3 text-left transition-opacity active:opacity-70"
      >
        <img src={coachFace(currentUser?.coachPersonality)} alt="" className="h-10 w-10 shrink-0 object-contain" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[15px] font-semibold">{note.title}</span>
          <span className="block truncate text-[13px] text-muted-foreground">{note.label}</span>
        </span>
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
      </button>
      <CoachItemDrawer item={open} onClose={() => setOpen(undefined)} />
    </>
  );
};
