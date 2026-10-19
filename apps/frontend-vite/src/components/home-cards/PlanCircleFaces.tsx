import { PersonAvatar } from "@/components/circles/components";
import { circleStatusLine } from "@/components/circles/model";
import type { PlanCircleFacesProps } from "@/components/circles/types";
import { useNavigate } from "@tanstack/react-router";

const FACE_SIZE = 22;

// The plan's circle, folded into its card: who is in it (green ring = on track this week).
// A forming circle shows its open spot. Tapping the faces opens the circle, not the plan.
export const PlanCircleFaces = ({ circle }: PlanCircleFacesProps) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label={`${circle.name}, ${circleStatusLine(circle)}`}
      onClick={(event) => {
        event.stopPropagation();
        navigate({ to: "/circle/$id", params: { id: circle.id } });
      }}
      className="-m-2 flex shrink-0 p-2 pl-3.5 active:opacity-70"
    >
      {circle.people.map((person, i) => (
        <div key={i} className="-ml-1.5">
          <PersonAvatar name={person.name} picture={person.picture} size={FACE_SIZE} ring={person.onTrack ? "on" : "off"} />
        </div>
      ))}
      {circle.status === "FORMING" && (
        <div
          className="-ml-1.5 rounded-full border-2 border-dashed border-muted-foreground/50"
          style={{ width: FACE_SIZE + 6, height: FACE_SIZE + 6 }}
        />
      )}
    </button>
  );
};
