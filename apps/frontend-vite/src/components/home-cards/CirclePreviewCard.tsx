import { PersonAvatar } from "@/components/circles/components";
import { circleStatusLine } from "@/components/circles/model";
import type { CirclePreviewCardProps } from "@/components/circles/types";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { HomeCardShell } from "./HomeCardShell";

// A circle next to the plans: who is in it, and whether the week is going well for them.
export const CirclePreviewCard = ({ circle }: CirclePreviewCardProps) => {
  const navigate = useNavigate();
  const theme = useThemeColors();
  const status = circleStatusLine(circle);
  return (
    <HomeCardShell onClick={() => navigate({ to: "/circle/$id", params: { id: circle.id } })}>
      <Users className="h-[26px] w-[26px]" style={{ color: theme.brightHex }} aria-label={`${circle.name}, ${status}`} />
      <div className="flex flex-col gap-1">
        <p className="line-clamp-2 text-lg font-semibold text-foreground">{circle.name}</p>
        <p className="line-clamp-2 text-[13px] text-muted-foreground">{status}</p>
      </div>
      <div className="flex pl-1.5">
        {circle.people.map((person, i) => (
          <div key={i} className="-ml-1.5">
            <PersonAvatar name={person.name} picture={person.picture} size={22} ring={person.onTrack ? "on" : "off"} />
          </div>
        ))}
      </div>
    </HomeCardShell>
  );
};
