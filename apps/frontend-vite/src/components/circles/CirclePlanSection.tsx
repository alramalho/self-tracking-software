import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Users } from "lucide-react";
import { defaultPreferences, useMyCircles } from "./api";
import { CirclePanel, PersonAvatar } from "./components";
import { circleStatusLine } from "./model";
import { setPendingMatch } from "./pendingMatch";
import type { CirclePlanSectionProps } from "./types";

// Your plan's circle at a glance, or the way to find one. One circle per plan.
export function CirclePlanSection({ planId }: CirclePlanSectionProps) {
  const navigate = useNavigate();
  const theme = useThemeColors();
  const mine = useMyCircles();
  if (!mine.data) return null;
  const circle = mine.data.find((each) => each.planId === planId);

  if (!circle)
    return (
      <button
        type="button"
        aria-label="Find a circle for this plan"
        onClick={() => {
          setPendingMatch({ planId, mode: "find", ...defaultPreferences });
          navigate({ to: "/circle-match", search: { planId } });
        }}
        className="flex min-h-[56px] w-full items-center gap-3.5 rounded-[20px] bg-card border border-border px-4 text-left transition-opacity hover:opacity-70"
      >
        <Users className="h-[22px] w-[22px] text-foreground" strokeWidth={1.8} />
        <span className="flex-1 text-base font-semibold text-foreground">Find a circle for this plan</span>
        <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
      </button>
    );

  const open = () => navigate({ to: "/circle/$id", params: { id: circle.id } });
  const status = circleStatusLine(circle);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Circle</h3>
        <button
          type="button"
          aria-label={`Open ${circle.name}`}
          onClick={open}
          className={cn("text-[15px] font-semibold", theme.text)}
        >
          Open ›
        </button>
      </div>
      <button
        type="button"
        aria-label={`${circle.name}, ${status}`}
        onClick={open}
        className="text-left transition-opacity hover:opacity-80"
      >
        <CirclePanel className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-0.5">
            <p className="truncate text-base font-semibold text-foreground">{`${circle.emoji} ${circle.name}`}</p>
            <p className="text-[13px] text-muted-foreground">{status}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {circle.people.map((person, i) => (
              <PersonAvatar
                key={i}
                name={person.name}
                picture={person.picture}
                size={26}
                ring={person.onTrack ? "on" : "off"}
              />
            ))}
          </div>
        </CirclePanel>
      </button>
    </div>
  );
}
