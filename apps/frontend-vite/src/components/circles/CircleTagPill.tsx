import { useNavigate } from "@tanstack/react-router";
import type { CircleTagPillProps } from "./types";

// Where a stranger's post came from: the circle you share with them.
export function CircleTagPill({ circle }: CircleTagPillProps) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label={`Open circle ${circle.name}`}
      onClick={(event) => {
        event.stopPropagation();
        navigate({ to: "/circle/$id", params: { id: circle.id } });
      }}
      className="max-w-[160px] truncate rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground transition-opacity hover:opacity-60"
    >
      {`${circle.emoji} ${circle.name}`}
    </button>
  );
}
