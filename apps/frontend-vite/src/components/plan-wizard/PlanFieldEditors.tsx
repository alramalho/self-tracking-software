import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { EmojiInput } from "@/components/ui/emoji-input";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { type Activity } from "@tsw/prisma";
import {
  Check,
  Crown,
  MoveRight,
  Plus,
  UserRound,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type PlanOutlineChoice = "SPECIFIC" | "TIMES_PER_WEEK";

export type DraftPlanActivity = {
  activityId?: string | null;
  title: string;
  measure: string;
  emoji: string;
  kind?: string | null;
};

type ActivityPickerActivity = Pick<Activity, "id" | "title" | "emoji" | "measure">;

export function PlanEmojiEditor({
  value,
  onChange,
  placeholder = "Pick an emoji",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="px-2 py-1 flex justify-center overflow-visible">
      <EmojiInput value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

export function PlanFrequencyEditor({
  value,
  onChange,
  title = "times per week",
  min = 1,
  max = 7,
}: {
  value: number;
  onChange: (value: number) => void;
  title?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="px-2 py-8">
      <NumberInput
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        title={title}
      />
    </div>
  );
}

export function PlanDurationEditor({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (value: Date | null) => void;
}) {
  return (
    <div className="space-y-4 px-2">
      <div className="flex items-center gap-2">
        <DatePicker
          id="date-picker-trigger"
          selected={value || undefined}
          onSelect={(date: Date | undefined) => onChange(date || null)}
          disablePastDates={true}
          className="flex-1"
        />
        {value && (
          <Button variant="ghost" size="icon" onClick={() => onChange(null)}>
            <XCircle className="w-4 h-4" />
          </Button>
        )}
      </div>

      {value && (
        <p className="text-sm text-muted-foreground text-center">
          Target: {value.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
    </div>
  );
}

type CoachingOption = {
  id: string;
  value: boolean;
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  requiresPremium: boolean;
};

const coachingOptions: CoachingOption[] = [
  {
    id: "coaching",
    value: true,
    title: "Coaching",
    description: "Get a coach that checks in when your plan needs attention",
    icon: Users,
    features: [
      "Specific weekly schedule",
      "Proactive check-ins for missed, stale, or upcoming work",
      "Plan changes suggested only when they help",
      "Great for: progressive and clear objective plans",
    ],
    requiresPremium: true,
  },
  {
    id: "self-guided",
    value: false,
    title: "Self-Guided",
    description: "Build your own routine with activities you choose",
    icon: UserRound,
    features: [
      "On a times per week basis",
      "Great for: recurring habits, simple tracking",
    ],
    requiresPremium: false,
  },
];

export function PlanCoachingModeEditor({
  value,
  onChange,
  recommended,
  isUserPremium = true,
  onBlockedPremium,
  compact = false,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  recommended?: boolean | null;
  isUserPremium?: boolean;
  onBlockedPremium?: () => void;
  compact?: boolean;
}) {
  const variants = useThemeColors();

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {coachingOptions.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={value === option.value ? "default" : "outline"}
            onClick={() => {
              if (option.value && !isUserPremium) {
                onBlockedPremium?.();
                return;
              }
              onChange(option.value);
            }}
          >
            {option.title}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 px-2">
      {coachingOptions.map((option) => {
        const Icon = option.icon;
        const isRecommended = recommended !== null && option.value === recommended;
        const showUpgradeBadge = option.requiresPremium && !isUserPremium;
        const isSelected = value === option.value;

        return (
          <button
            key={option.id}
            onClick={() => {
              if (option.value && !isUserPremium) {
                onBlockedPremium?.();
                return;
              }
              onChange(option.value);
            }}
            className={cn(
              "w-full rounded-xl border-2 p-6 text-left transition-all duration-200 hover:bg-muted/50",
              isSelected || isRecommended
                ? `${variants.card.selected.border} ${variants.card.selected.bg}`
                : "border-border"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-muted">
                <Icon className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-foreground">
                    {option.title}
                  </h3>
                  {isRecommended && (
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", variants.text, variants.veryFadedBg)}>
                      Recommended
                    </span>
                  )}
                  {showUpgradeBadge && (
                    <span className="text-xs font-medium text-yellow-600 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      Premium
                    </span>
                  )}
                </div>
                <p className="text-sm mt-1 text-muted-foreground">
                  {option.description}
                </p>
                <ul className="mt-3 space-y-1">
                  {option.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className={cn("w-4 h-4 flex-shrink-0", variants.text)} />
                      {feature}
                    </li>
                  ))}
                </ul>
                {showUpgradeBadge && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                    <span>Upgrade to unlock</span>
                    <MoveRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function PlanOutlineTypeEditor({
  value,
  onChange,
}: {
  value: PlanOutlineChoice;
  onChange: (value: PlanOutlineChoice) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant={value === "TIMES_PER_WEEK" ? "default" : "outline"}
        onClick={() => onChange("TIMES_PER_WEEK")}
      >
        Flexible target
      </Button>
      <Button
        type="button"
        variant={value === "SPECIFIC" ? "default" : "outline"}
        onClick={() => onChange("SPECIFIC")}
      >
        Scheduled sessions
      </Button>
    </div>
  );
}

export function DraftActivitiesEditor({
  activities,
  onChange,
  existingActivities = [],
}: {
  activities: DraftPlanActivity[];
  onChange: (activities: DraftPlanActivity[]) => void;
  existingActivities?: ActivityPickerActivity[];
}) {
  const activityKey = (activity: Pick<DraftPlanActivity, "title" | "measure">) =>
    `${activity.title.trim().toLowerCase()}::${activity.measure.trim().toLowerCase()}`;
  const activityTitleKey = (activity: Pick<DraftPlanActivity, "title">) =>
    activity.title.trim().toLowerCase();

  const existingTitleKeys = new Set(existingActivities.map(activityTitleKey));
  const toDraftOnlyPickerActivity = (
    activity: DraftPlanActivity
  ): ActivityPickerActivity => ({
    id: `draft-${activityKey(activity)}`,
    title: activity.title,
    emoji: activity.emoji,
    measure: activity.measure,
  });
  const currentDraftOnlyActivities = useMemo(
    () =>
      activities
        .filter(
          (activity) =>
            !activity.activityId &&
            !existingTitleKeys.has(activityTitleKey(activity))
        )
        .map(toDraftOnlyPickerActivity),
    [activities, existingActivities]
  );
  const [draftOnlyOptions, setDraftOnlyOptions] = useState<ActivityPickerActivity[]>(
    currentDraftOnlyActivities
  );

  useEffect(() => {
    setDraftOnlyOptions((current) => {
      const byKey = new Map(current.map((activity) => [activity.id, activity]));
      for (const activity of currentDraftOnlyActivities) {
        byKey.set(activity.id, activity);
      }
      return Array.from(byKey.values());
    });
  }, [currentDraftOnlyActivities]);

  const draftOnlyActivities = draftOnlyOptions;

  const pickerActivities = [...existingActivities, ...draftOnlyActivities].sort((a, b) =>
    a.title.localeCompare(b.title)
  );
  const draftOnlyIdsByTitle = new Map(
    draftOnlyActivities.map((activity) => [activityTitleKey(activity), activity.id])
  );

  const selectedActivities = activities.map((activity, index) => {
    const matchingExisting =
      (activity.activityId
        ? existingActivities.find((existing) => existing.id === activity.activityId)
        : null) ||
      existingActivities.find(
        (existing) => activityTitleKey(existing) === activityTitleKey(activity)
      );
    return (
      matchingExisting || {
        id:
          draftOnlyIdsByTitle.get(activityTitleKey(activity)) ||
          `selected-draft-${index}-${activityKey(activity)}`,
        title: activity.title,
        emoji: activity.emoji,
        measure: activity.measure,
      }
    );
  });

  const toggleActivity = (activity: ActivityPickerActivity) => {
    const existingActivity = existingActivities.find((existing) => existing.id === activity.id);
    const isSelected = activities.some((selected) =>
      selected.activityId
        ? selected.activityId === activity.id
        : activityTitleKey(selected) === activityTitleKey(activity)
    );
    if (isSelected) {
      onChange(
        activities.filter((selected) =>
          selected.activityId
            ? selected.activityId !== activity.id
            : activityTitleKey(selected) !== activityTitleKey(activity)
        )
      );
      return;
    }

    onChange([
      ...activities,
      {
        activityId: existingActivity?.id || null,
        title: activity.title,
        emoji: activity.emoji,
        measure: activity.measure,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      {draftOnlyActivities.length > 0 && (
        <div className="rounded-lg border border-dashed border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Dashed activities are new.</span>{" "}
          They will be created when the plan is accepted; the rest reuse your existing activities.
        </div>
      )}
      <ActivityPickerGrid
        activities={pickerActivities}
        selectedActivities={selectedActivities}
        recommendedIds={draftOnlyActivities.map((activity) => activity.id)}
        onToggle={toggleActivity}
        onAddNew={() =>
          onChange([
            ...activities,
            { title: "New activity", measure: "sessions", emoji: "📋" },
          ])
        }
      />
    </div>
  );
}

export function ActivityPickerGrid({
  activities,
  selectedActivities,
  recommendedIds = [],
  onToggle,
  onAddNew,
}: {
  activities: ActivityPickerActivity[];
  selectedActivities: ActivityPickerActivity[];
  recommendedIds?: string[];
  onToggle: (activity: ActivityPickerActivity) => void;
  onAddNew: () => void;
}) {
  const variants = useThemeColors();

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {activities.map((activity) => {
        const isSelected = selectedActivities.some((a) => a.id === activity.id);
        const isRecommended = recommendedIds.includes(activity.id);

        return (
          <button
            key={activity.id}
            onClick={() => onToggle(activity)}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-lg border-2 aspect-square transition-all relative",
              isSelected
                ? `${isRecommended ? "border-dashed" : ""} ${variants.card.selected.border} ${variants.card.selected.bg}`
                : isRecommended
                  ? `border-dashed ${variants.border} ${variants.card.glassBg}`
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-input"
            )}
          >
            {isRecommended && !isSelected && (
              <div className="absolute -top-1 -right-1">
                <Check className={cn("w-3 h-3", variants.text)} />
              </div>
            )}
            <span className="text-2xl mb-1">{activity.emoji}</span>
            <span className="text-xs font-medium text-center line-clamp-2">
              {activity.title}
            </span>
            {isSelected && <Check className={cn("w-4 h-4 mt-1", variants.text)} />}
          </button>
        );
      })}
      <button
        onClick={onAddNew}
        className="flex flex-col bg-input items-center justify-center p-4 rounded-lg border-2 border-dashed border-border aspect-square hover:bg-input/50"
      >
        <Plus className="h-6 w-6 text-muted-foreground mb-1" />
        <span className="text-xs font-medium text-muted-foreground">Add New</span>
      </button>
    </div>
  );
}
