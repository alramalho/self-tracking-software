import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Flame, Users } from "lucide-react";
import toast from "react-hot-toast";
import { defaultPreferences, useCircle, useCircleActions, useMyCircles } from "./api";
import { CirclePanel, MemberRow } from "./components";
import { daysLeftLabel, firstName, MATCHING_TARGET } from "./model";
import { setPendingMatch } from "./pendingMatch";
import type { BoardMember, CirclePlanSectionProps, MyCircle } from "./types";

function planStatusLine(circle: MyCircle): string {
  if (circle.pending) return "Post a photo to join";
  if (circle.status === "FORMING") return "Forming · the board starts at 2";
  return `This week · ${daysLeftLabel(circle.daysLeft)}`;
}

// Your plan's circle at a glance, or the way to find one. One circle per plan.
export function CirclePlanSection({ planId }: CirclePlanSectionProps) {
  const navigate = useNavigate();
  const theme = useThemeColors();
  const { currentUser } = useCurrentUser();
  const mine = useMyCircles();
  const circle = mine.data?.find((each) => each.planId === planId);
  const board = useCircle(circle?.id);
  const { nudge } = useCircleActions();
  if (!mine.data) return null;

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
  const data = board.data;
  const openSpots = Math.max(0, MATCHING_TARGET - (data?.members.length ?? circle.memberCount));
  const status = planStatusLine(circle);
  const nudgeMember = (member: BoardMember) =>
    nudge.mutate(
      { circleId: circle.id, userId: member.user.id },
      {
        onSuccess: () => toast.success(`Nudged ${firstName(member.user)}`),
        onError: (error) => toast.error(toApiErrorMessage(error)),
      }
    );

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
      {/* The circle's week at a glance, like its board: dots, what's left, and a nudge. */}
      <CirclePanel className="flex flex-col gap-0.5">
        <button
          type="button"
          aria-label={`${circle.name}, ${status}`}
          onClick={open}
          className="flex items-center gap-2.5 pb-1.5 text-left transition-opacity hover:opacity-70"
        >
          <span className="text-[22px]">{circle.emoji}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-base font-semibold text-foreground">{circle.name}</span>
            <span className="text-[13px] text-muted-foreground">{status}</span>
          </span>
          {!!data?.togetherStreak && (
            <span className="flex items-center gap-0.5">
              <Flame className="h-[18px] w-[18px]" color="#ff9500" />
              <span className="text-sm font-semibold text-foreground">{data.togetherStreak}</span>
            </span>
          )}
        </button>
        {data?.members.map((member) => {
          const isMe = member.user.id === currentUser?.id;
          return (
            <MemberRow
              key={member.user.id}
              member={data.status === "FORMING" ? { ...member, week: { ...member.week, isNew: true } } : member}
              isMe={isMe}
              onNudge={!isMe && member.week.behind && !member.nudgedToday ? () => nudgeMember(member) : undefined}
            />
          );
        })}
        {openSpots > 0 && (
          <p className="pt-1.5 text-[13px] text-muted-foreground">
            {`${openSpots} open ${openSpots === 1 ? "spot" : "spots"} · looking for people with a similar goal`}
          </p>
        )}
      </CirclePanel>
    </div>
  );
}
