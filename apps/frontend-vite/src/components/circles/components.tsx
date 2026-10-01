import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { Cake, Check, ChevronRight, Gauge, Hand, Lock, MapPin, Target } from "lucide-react";
import { avatarColor, firstName, MATCHING_TARGET, weekChipLabel } from "./model";
import type {
  CircleCardViewProps,
  CirclePanelProps,
  MatchPreferencesListProps,
  MatchReason,
  MemberRowProps,
  OpenSpotsProps,
  PersonAvatarProps,
  PreferenceChoice,
  ReasonChipsProps,
  WeekChipPillProps,
  WeekDotsProps,
} from "./types";

const ON_TRACK_GREEN = "#22c55e";
const BEHIND_ORANGE = "#fb923c";

export function CirclePanel({ children, className }: CirclePanelProps) {
  return (
    <div className={cn("rounded-2xl bg-card border border-border p-4", className)}>
      {children}
    </div>
  );
}

export function PersonAvatar({ name, picture, size = 32, ring }: PersonAvatarProps) {
  const theme = useThemeColors();
  const ringColor =
    ring === "on"
      ? ON_TRACK_GREEN
      : ring === "accent"
        ? theme.hex
        : ring === "off"
          ? "var(--color-muted)"
          : undefined;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size + (ringColor ? 6 : 0),
        height: size + (ringColor ? 6 : 0),
        border: ringColor ? `2px solid ${ringColor}` : undefined,
        padding: ringColor ? 1 : 0,
      }}
    >
      <div
        className="flex items-center justify-center overflow-hidden rounded-full"
        style={{ width: size, height: size, backgroundColor: avatarColor(name ?? "?") }}
      >
        {picture ? (
          <img src={picture} alt={name ?? ""} className="h-full w-full object-cover" />
        ) : (
          <span className="font-bold text-white" style={{ fontSize: size * 0.42 }}>
            {(name ?? "?").slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

// On a circle log: how far into their week it was. Green only on the one that completes the week.
export function WeekChipPill({ chip }: WeekChipPillProps) {
  const { text, done } = weekChipLabel(chip);
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        done ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-muted text-foreground"
      )}
    >
      {text}
    </span>
  );
}

// One dot per planned session this week, green once done.
export function WeekDots({ target, done }: WeekDotsProps) {
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: Math.max(target, 1) }, (_, i) => (
        <span
          key={i}
          className={cn("h-[9px] w-[9px] rounded-full", i >= done && "bg-muted")}
          style={i < done ? { backgroundColor: ON_TRACK_GREEN } : undefined}
        />
      ))}
    </div>
  );
}

// Board row: who, their goal, this week's dots, and encouragement for anyone behind.
// "N to go" in orange is the only signal that someone is behind.
export function MemberRow({ member, isMe, onPress, onMotivate }: MemberRowProps) {
  const { week } = member;
  const name = isMe ? "You" : firstName(member.user);
  const waiting = member.pending || week.isNew;
  const progress = waiting ? "" : week.behind ? `${week.toGo} to go` : `${week.done}/${week.target}`;
  return (
    <div className="flex items-center gap-2.5 py-2.5">
      <button
        type="button"
        disabled={!onPress}
        onClick={onPress}
        aria-label={`${name}, ${member.pending ? "pending" : week.isNew ? "new this week" : `${week.done} of ${week.target} this week`}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-opacity enabled:hover:opacity-70"
      >
        <PersonAvatar
          name={member.user.name ?? member.user.username ?? null}
          picture={member.user.picture}
          size={34}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {member.plan.emoji ? `${member.plan.emoji} ` : ""}
            {member.plan.goal}
          </p>
        </div>
        {waiting ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
            {member.pending ? "Pending" : "New"}
          </span>
        ) : (
          <WeekDots target={week.target} done={week.done} />
        )}
        <span
          className={cn(
            "w-[52px] text-right text-[13px] tabular-nums",
            week.behind ? "font-semibold" : "text-muted-foreground"
          )}
          style={week.behind ? { color: BEHIND_ORANGE } : undefined}
        >
          {progress}
        </span>
      </button>
      <div className="flex w-[34px] justify-end">
        {onMotivate && (
          <button
            type="button"
            aria-label={`Motivate ${firstName(member.user)}`}
            onClick={onMotivate}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground hover:opacity-70"
          >
            <Hand className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Spots matching will still fill, up to MATCHING_TARGET members. With onInvite, each one opens the invite sheet.
export function OpenSpots({ members, onInvite }: OpenSpotsProps) {
  const open = Math.max(0, MATCHING_TARGET - members);
  if (!open) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="pt-2 text-xs text-muted-foreground">Looking for people with a similar goal</p>
      {Array.from({ length: open }, (_, i) => (
        <button
          key={i}
          type="button"
          disabled={!onInvite}
          onClick={onInvite}
          aria-label={onInvite ? "Invite to an open spot" : undefined}
          className="flex items-center gap-2.5 py-2 text-left transition-opacity enabled:hover:opacity-60"
        >
          <span className="h-[34px] w-[34px] rounded-full border-[1.5px] border-dashed border-muted-foreground" />
          <span className="text-[15px] text-muted-foreground">Open spot</span>
        </button>
      ))}
    </div>
  );
}

const reasonLabels: Record<MatchReason, string> = {
  goal: "Similar goal",
  pace: "Similar pace",
  sameCity: "Same city",
  timezone: "Same time zone",
  age: "Similar age",
};

export function ReasonChips({ reasons }: ReasonChipsProps) {
  const theme = useThemeColors();
  if (!reasons.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {reasons.map((reason) => (
        <span
          key={reason}
          className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", theme.veryFadedBg, theme.text)}
        >
          {reasonLabels[reason]}
        </span>
      ))}
    </div>
  );
}

// Search result: what the circle is, and blurred squares of its latest photos so
// you can see people really post. Only blurred previews ever reach non-members.
export function CircleCardView({ card, onPress }: CircleCardViewProps) {
  const meta = [
    `${card.memberCount} of 5`,
    card.place,
    card.logsThisWeek ? `${card.logsThisWeek} logs this week` : card.paceLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      type="button"
      aria-label={`${card.name}, ${meta}`}
      onClick={onPress}
      className="flex w-full flex-col gap-2.5 rounded-[20px] bg-card border border-border p-3.5 text-left transition-opacity hover:opacity-80"
    >
      <div className="flex w-full items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-muted text-[22px]">
          {card.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{card.name}</p>
          <p className="truncate text-[13px] text-muted-foreground">{meta}</p>
        </div>
        <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
      </div>
      {card.previews.length > 0 && (
        <div className="flex w-full gap-1.5">
          {card.previews.map((uri, i) => (
            <div key={i} className="relative h-[58px] flex-1 overflow-hidden rounded-xl bg-muted">
              <img
                src={uri}
                alt=""
                className="h-full w-full scale-110 object-cover blur-[6px]"
              />
              {i === card.previews.length - 1 && card.morePhotos > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm font-bold text-white">
                  +{card.morePhotos}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <ReasonChips reasons={card.reasons} />
    </button>
  );
}

// "Match me by": goal always counts, the rest are the person's choice.
export function MatchPreferencesList({ value, onChange, place, age, weeklyTarget }: MatchPreferencesListProps) {
  const theme = useThemeColors();
  const choices: PreferenceChoice[] = [
    { key: "wantsPace", icon: Gauge, title: "Pace", detail: `${weeklyTarget} a week` },
    { key: "wantsNearby", icon: MapPin, title: "Nearby", detail: place },
    { key: "wantsAge", icon: Cake, title: "Age", detail: age ? String(age) : null },
  ];
  return (
    <div className="overflow-hidden rounded-2xl bg-card border border-border">
      <div className="flex min-h-[56px] items-center gap-3.5 px-4" role="checkbox" aria-checked aria-disabled aria-label="Goal">
        <Target className="h-[22px] w-[22px] text-foreground" strokeWidth={1.8} />
        <span className="flex-1 text-[17px] text-foreground">Goal</span>
        <Lock className="h-[18px] w-[18px] text-muted-foreground" />
      </div>
      {choices.map((choice) => (
        <button
          key={choice.key}
          type="button"
          role="checkbox"
          aria-checked={value[choice.key]}
          aria-label={choice.title}
          onClick={() => onChange({ ...value, [choice.key]: !value[choice.key] })}
          className="flex min-h-[56px] w-full items-center gap-3.5 border-t border-border px-4 text-left hover:bg-muted/40"
        >
          <choice.icon className="h-[22px] w-[22px] text-foreground" strokeWidth={1.8} />
          <span className="flex flex-1 flex-col">
            <span className="text-[17px] text-foreground">{choice.title}</span>
            {!!choice.detail && (
              <span className="text-[13px] text-muted-foreground">{choice.detail}</span>
            )}
          </span>
          {value[choice.key] && <Check className={cn("h-[22px] w-[22px]", theme.text)} strokeWidth={2.4} />}
        </button>
      ))}
    </div>
  );
}
