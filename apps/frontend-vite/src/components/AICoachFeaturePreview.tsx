"use client";
import AppleLikePopover from "@/components/AppleLikePopover";
import { MessageBubble } from "@/components/MessageBubble";
import { MetricWeeklyView } from "@/components/MetricWeeklyView";
import {
  PlanProposalCard,
  type ResolvedOperation,
} from "@/components/PlanProposalCard";
import { SteppedBarProgress } from "@/components/SteppedBarProgress";
import { HomeCardShell } from "@/components/home-cards/HomeCardShell";
import { type PlanProgressData } from "@/contexts/plans-progress";
import {
  coachPersonalityOptions,
  getCoachAvatar,
  getCoachPersonalityConfig,
  type CoachPersonality,
} from "@/lib/coachPersonality";
import { cn } from "@/lib/utils";
import { type Activity, type ActivityEntry } from "@tsw/prisma";
import {
  Check,
  Flame,
  Home,
  LandPlot,
  MoveRight,
  NotepadText,
  Rocket,
  Route,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { MetricIsland } from "./MetricIsland";
import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Dummy data for coach overview demo
const DEMO_PLAN_ID = "demo-coach-plan";
const DEMO_PLAN_GOAL = "Read 30 minutes daily";
const DEMO_PLAN_EMOJI = "📚";

const dummyActivities = [
  {
    id: "reading-activity",
    title: "Reading",
    emoji: DEMO_PLAN_EMOJI,
    unit: "minutes",
  },
];

// Create dummy activity entries to simulate completed activities
const dummyActivityEntries = [
  {
    id: "1",
    activityId: "reading-activity",
    date: new Date().toISOString(),
    quantity: 30,
    userId: "demo-user",
  },
  {
    id: "2",
    activityId: "reading-activity",
    date: new Date(Date.now() - 86400000).toISOString(),
    quantity: 30,
    userId: "demo-user",
  },
  {
    id: "3",
    activityId: "reading-activity",
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
    quantity: 30,
    userId: "demo-user",
  },
];

const dummyMetric = {
  id: "1",
  title: "Happiness",
  emoji: "😊",
};

// Create plan progress data for demo
export const dummyPlanProgressData: PlanProgressData = {
  plan: {
    emoji: DEMO_PLAN_EMOJI,
    goal: DEMO_PLAN_GOAL,
    id: DEMO_PLAN_ID,
    type: "TIMES_PER_WEEK",
  },
  achievement: {
    streak: 3,
    completedWeeks: 2,
    incompleteWeeks: 0,
    totalWeeks: 8,
  },
  currentWeekStats: {
    numActiveDaysInTheWeek: 3,
    numLeftDaysInTheWeek: 4,
    numActiveDaysLeftInTheWeek: 4,
    daysCompletedThisWeek: 3,
  },
  habitAchievement: {
    progressValue: 3,
    maxValue: 7,
    isAchieved: false,
    progressPercentage: 43,
  },
  lifestyleAchievement: {
    progressValue: 90,
    maxValue: 210,
    isAchieved: false,
    progressPercentage: 43,
  },
  currentWeekState: "ON_TRACK",
  weeks: [
    {
      startDate: new Date(),
      activities: dummyActivities as unknown as Activity[],
      completedActivities: dummyActivityEntries as unknown as ActivityEntry[],
      plannedActivities: 7,
      weekActivities: dummyActivities as unknown as Activity[],
      isCompleted: false,
    },
  ],
};

const CardItem = ({
  icon,
  title,
  onDemoClick,
}: {
  icon: React.ReactNode;
  title: string;
  onDemoClick?: () => void;
}) => {
  return (
    <div
      className={`w-full p-2 px-6 rounded-xl transition-all duration-200 text-left `}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center bg-muted`}
        >
          {icon}
        </div>
        <div className="flex flex-col gap-0 w-full my-auto">
          <p className={`text-md font-normal text-muted-foreground justify-between`}>
            {title}
          </p>
          {onDemoClick && (
            <button
              type="button"
              onClick={onDemoClick}
              className="p-0 self-start flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground"
            >
              <span className="text-sm font-medium font-mono">View demo</span>
              <MoveRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface HumanCoachInfo {
  id: string;
  name: string | null;
  username: string;
  picture: string | null;
  title: string;
}

interface AICoachFeaturePreviewProps {
  children?: React.ReactNode;
  humanCoach?: HumanCoachInfo | null;
  aiCoachPersonality?: CoachPersonality;
  onCoachPersonalitySelect?: (personality: CoachPersonality) => void;
  coachPersonalityDisabled?: boolean;
  inlineDemos?: boolean;
}

const coachTextClassName: Record<CoachPersonality, string> = {
  CHAMPION: "text-[#d98f8b]",
  STRATEGIST: "text-slate-400",
};

const demoProposalOperations: ResolvedOperation[] = [
  {
    type: "update_plan",
    timesPerWeek: 3,
  },
];

const resolveDemoAction = async () => {};

const MockCoachActionsCard = ({
  personality,
}: {
  personality: CoachPersonality;
}) => {
  const aiCoach = getCoachPersonalityConfig(personality);

  return (
    <HomeCardShell className="bg-card/90">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full animate-ping bg-amber-400/30" />
        <img
          src={getCoachAvatar(personality, "thinking")}
          alt={aiCoach.label}
          className="relative z-10 h-12 w-12 object-contain"
        />
      </div>
      <p className="text-base font-medium text-foreground">
        1 coach action pending
      </p>
    </HomeCardShell>
  );
};

const MockPlanHomeCard = () => {
  return (
    <HomeCardShell className="bg-card/90">
      <div>
        <span className="text-2xl">🏃‍♂️</span>
        <p className="text-sm font-medium text-foreground line-clamp-2 mt-1">
          train 4 times a week
        </p>
      </div>
      <div className="space-y-2.5">
        <SteppedBarProgress
          value={1}
          maxValue={4}
          goal={<Flame size={14} className="text-orange-400" />}
          compact
        />
        <SteppedBarProgress
          value={5}
          maxValue={8}
          goal={<Rocket size={14} className="text-amber-400" />}
          compact
          color="bg-amber-400"
        />
      </div>
    </HomeCardShell>
  );
};

const MockHomeActionCards = ({
  personality,
}: {
  personality: CoachPersonality;
}) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      <MockCoachActionsCard personality={personality} />
      <MockPlanHomeCard />
    </div>
  );
};

const MockCoachActionMessages = ({
  personality,
}: {
  personality: CoachPersonality;
}) => {
  const aiCoach = getCoachPersonalityConfig(personality);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 pl-[3.75rem] text-[11px] font-medium text-primary">
        <Sparkles size={12} />
        <span>{aiCoach.name} has a plan action</span>
      </div>
      <div className="flex items-start gap-3">
        <div className="relative mt-1 h-12 w-12 shrink-0">
          <div className="absolute inset-0 rounded-full bg-primary/10" />
          <img
            src={getCoachAvatar(personality, "coachSpeaking")}
            alt={aiCoach.label}
            className="relative z-10 h-12 w-12 object-contain"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <MessageBubble
            direction="left"
            timestamp="2026-06-02T19:46:00"
            tailPosition="top"
            className="bg-muted/60"
          >
            <div className="text-sm whitespace-pre-wrap">
              Training is at risk this week. 4x/week is creating too much
              catch-up.
            </div>
          </MessageBubble>
          <MessageBubble
            direction="left"
            timestamp="2026-06-02T19:47:00"
            tailPosition="top"
            className="bg-muted/60"
          >
            <div className="text-sm whitespace-pre-wrap">
              I suggest 3 sessions next week so the plan stays realistic.
            </div>
          </MessageBubble>
          <PlanProposalCard
            messageId="demo-plan-action-message"
            proposalIndex={0}
            planGoal="train 4 times a week"
            planEmoji="🏃‍♂️"
            description="Reduce next week from 4 training sessions to 3."
            operations={demoProposalOperations}
            status={null}
            onAccept={resolveDemoAction}
            onReject={resolveDemoAction}
          />
        </div>
      </div>
    </div>
  );
};

const checkInMessages = [
  "How many sessions did you actually manage this week?",
  "You planned 4 workouts. I only see 1 logged. What got in the way?",
  "Want me to make next week easier to restart?",
  "How's robotics going? I haven't seen a log in a few days.",
  "Want a lighter version of this plan for the next 7 days?",
];

const MockCoachCheckInMessages = ({
  personality,
}: {
  personality: CoachPersonality;
}) => {
  const aiCoach = getCoachPersonalityConfig(personality);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % checkInMessages.length);
    }, 3200);

    return () => window.clearInterval(interval);
  }, []);

  const activeMessage = checkInMessages[messageIndex];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 pl-[3.75rem] text-[11px] font-medium text-primary">
        <Send size={12} />
        <span>{aiCoach.name} checks in</span>
      </div>
      <div className="flex items-start gap-3">
        <div className="relative mt-1 h-12 w-12 shrink-0">
          <div className="absolute inset-0 rounded-full bg-primary/10" />
          <img
            src={getCoachAvatar(personality, "coachSpeaking")}
            alt={aiCoach.label}
            className="relative z-10 h-12 w-12 object-contain"
          />
        </div>
        <motion.div
          layout
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0 flex-1"
        >
          <MessageBubble
            direction="left"
            timestamp="2026-06-04T20:12:00"
            tailPosition="top"
            className="bg-muted/60"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeMessage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="text-sm"
              >
                {activeMessage}
              </motion.div>
            </AnimatePresence>
          </MessageBubble>
        </motion.div>
      </div>
    </div>
  );
};

export const AICoachFeaturePreview: React.FC<AICoachFeaturePreviewProps> = ({
  children,
  humanCoach,
  aiCoachPersonality,
  onCoachPersonalitySelect,
  coachPersonalityDisabled = false,
  inlineDemos = false,
}) => {
  const [activeDemo, setActiveDemo] = useState<
    "home" | "plan-action" | "metrics" | null
  >(null);
  const [activeInlineDemo, setActiveInlineDemo] = useState<
    "home" | "check-in" | "plan-action" | "metrics" | null
  >(null);
  const [selectedPersonality, setSelectedPersonality] =
    useState<CoachPersonality>(
      () => getCoachPersonalityConfig(aiCoachPersonality).id
    );

  useEffect(() => {
    setSelectedPersonality(getCoachPersonalityConfig(aiCoachPersonality).id);
  }, [aiCoachPersonality]);

  const aiCoach = getCoachPersonalityConfig(selectedPersonality);
  const featureIconClassName =
    !humanCoach
      ? cn("w-8 h-8", coachTextClassName[aiCoach.id])
      : "w-8 h-8 text-muted-foreground";

  const selectPersonality = (personality: CoachPersonality) => {
    if (coachPersonalityDisabled) return;
    setSelectedPersonality(personality);
    onCoachPersonalitySelect?.(personality);
  };

  const toggleInlineDemo = (
    demo: "home" | "check-in" | "plan-action" | "metrics"
  ) => {
    setActiveInlineDemo((current) => (current === demo ? null : demo));
  };

  const inlineDemoContent = (
    demo: "home" | "check-in" | "plan-action" | "metrics"
  ) => {
    if (demo === "home") {
      return <MockHomeActionCards personality={selectedPersonality} />;
    }
    if (demo === "check-in") {
      return <MockCoachCheckInMessages personality={selectedPersonality} />;
    }
    if (demo === "plan-action") {
      return <MockCoachActionMessages personality={selectedPersonality} />;
    }

    return (
      <div className="space-y-3">
        <MetricIsland
          metric={dummyMetric}
          isLoggedToday={false}
          className="bg-card"
        />
        <MetricWeeklyView
          metric={dummyMetric}
          weekData={[3, 4, 0, 5, 4, 3, 4]}
          color="blue"
          hasAnyData={true}
          positiveCorrelations={[
            {
              activity: {
                id: "exercise",
                title: "Exercise",
                emoji: "🏃‍♂️",
                measure: "minutes",
              } as Activity,
              correlation: 0.65,
            },
            {
              activity: {
                id: "meditation",
                title: "Meditation",
                emoji: "🧘‍♂️",
                measure: "minutes",
              } as Activity,
              correlation: 0.45,
            },
          ]}
          className="bg-card"
        />
      </div>
    );
  };

  return (
    <>
      <div className="w-full max-w-lg space-y-2">
      <div className="flex flex-col items-center gap-4 text-center pt-0">
        <div className="flex flex-col items-center gap-2">
          {humanCoach ? (
            <img
              src={humanCoach.picture || "/images/default-avatar.png"}
              className="w-24 h-24 rounded-full object-cover"
              alt={humanCoach.name || humanCoach.username}
            />
          ) : (
            <div className="relative h-32 w-44">
              {coachPersonalityOptions.map((coach) => {
                const selected = selectedPersonality === coach.id;
                const isChampion = coach.id === "CHAMPION";

                return (
                  <button
                    key={coach.id}
                    type="button"
                    onClick={() => selectPersonality(coach.id)}
                    disabled={coachPersonalityDisabled}
                    aria-label={`Select ${coach.label}`}
                    className={cn(
                      "absolute h-24 w-24 rounded-full transition-all duration-300 disabled:cursor-not-allowed",
                      isChampion
                        ? "left-5 top-3 -rotate-6"
                        : "right-5 top-8 rotate-6",
                      selected
                        ? "z-20 scale-110 opacity-100 drop-shadow-sm"
                        : "z-10 scale-95 opacity-70 hover:opacity-90"
                    )}
                  >
                    <img
                      src={getCoachAvatar(
                        coach.id,
                        selected ? "coachExcited" : "neutral"
                      )}
                      className="h-full w-full object-contain"
                      alt={coach.label}
                    />
                  </button>
                );
              })}
            </div>
          )}
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            {humanCoach ? (
              <>
                Meet {humanCoach.name || humanCoach.username},
                <br /> your new coach
              </>
            ) : (
              <>
                Meet Helly and Oli,
                <br /> your AI coaches
              </>
            )}
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          {humanCoach ? (
            <>
              {humanCoach.name || humanCoach.username} will help you stay on track and motivated.
              <br />
              Here&apos;s what coaching includes:
            </>
          ) : (
            <>
              Pick the coaching style that helps you follow through.
              <br />
              You can switch anytime.
            </>
          )}
        </p>
      </div>

      {!humanCoach && (
        <div className="grid gap-2 px-2 py-2">
          {coachPersonalityOptions.map((coach) => {
            const selected = selectedPersonality === coach.id;

            return (
              <button
                key={coach.id}
                type="button"
                disabled={coachPersonalityDisabled}
                onClick={() => selectPersonality(coach.id)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-70",
                  selected
                    ? coach.accentClassName
                    : "border-border bg-card/70 hover:bg-accent/50"
                )}
              >
                <img
                  src={getCoachAvatar(
                    coach.id,
                    selected ? "coachSmiling" : "neutral"
                  )}
                  alt={coach.label}
                  className="h-12 w-12 shrink-0 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {coach.label}
                    </p>
                    {selected && (
                      <Check
                        className={cn("h-4 w-4", coachTextClassName[coach.id])}
                      />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-foreground">
                    {coach.shortChoice}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {coach.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {inlineDemos && !humanCoach && (
        <div className="space-y-1 py-2">
          {[
            {
              id: "home" as const,
              icon: <LandPlot className={featureIconClassName} />,
              title: "Monitoring your plan state from the homepage",
            },
            {
              id: "check-in" as const,
              icon: <Send className={featureIconClassName} />,
              title: "Checking in several times a week",
            },
            {
              id: "plan-action" as const,
              icon: <Route className={featureIconClassName} />,
              title: "Adapting next week's plan based on progress",
            },
            {
              id: "metrics" as const,
              icon: <NotepadText className={featureIconClassName} />,
              title: "Finding useful patterns in your metrics",
            },
          ].map((item) => (
            <div key={item.id}>
              <CardItem
                icon={item.icon}
                title={item.title}
                onDemoClick={() => toggleInlineDemo(item.id)}
              />
              <AnimatePresence initial={false}>
                {activeInlineDemo === item.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -6 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-2 pb-6 pt-2">
                      {inlineDemoContent(item.id)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {!inlineDemos && (
        <>
          <div className="space-y-0">
            <CardItem
              icon={<LandPlot className={featureIconClassName} />}
              title="Monitoring your plan state from the homepage"
              onDemoClick={humanCoach ? undefined : () => setActiveDemo("home")}
            />
            <CardItem
              icon={<Send className={featureIconClassName} />}
              title="Checking in several times a week"
            />
            <CardItem
              icon={<Route className={featureIconClassName} />}
              title="Adapting next week's plan based on progress"
              onDemoClick={
                humanCoach ? undefined : () => setActiveDemo("plan-action")
              }
            />
            <CardItem
              icon={<NotepadText className={featureIconClassName} />}
              title="Finding useful patterns in your metrics"
              onDemoClick={humanCoach ? undefined : () => setActiveDemo("metrics")}
            />
          </div>
          <p className="text-md text-muted-foreground w-full text-center py-2">
            And many more features to come!
          </p>
        </>
      )}

      {children}
    </div>

      <AppleLikePopover
        open={activeDemo === "home"}
        onClose={() => setActiveDemo(null)}
        title="Coach homepage demo"
        className="max-w-md"
      >
        <div className="pt-5">
          <p className="mb-4 text-md text-muted-foreground font-semibold">
            In your <Home className="w-5 h-5 inline-block mb-1" /> Homepage,{" "}
            {aiCoach.name} keeps the plan state and pending actions easy to
            spot.
          </p>
          <MockHomeActionCards personality={selectedPersonality} />
        </div>
      </AppleLikePopover>

      <AppleLikePopover
        open={activeDemo === "plan-action"}
        onClose={() => setActiveDemo(null)}
        title="Coach plan action demo"
        className="max-w-md"
      >
        <div className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground font-semibold">
            On the <Target className="w-5 h-5 inline-block mb-1" /> Plans page,{" "}
            {aiCoach.name} can explain the risk and show the exact change to
            accept or reject.
          </p>
          <MockCoachActionMessages personality={selectedPersonality} />
        </div>
      </AppleLikePopover>

      <AppleLikePopover
        open={activeDemo === "metrics"}
        onClose={() => setActiveDemo(null)}
        title="Coach metrics demo"
        className="max-w-md"
      >
        <div className="flex flex-col gap-2 pt-5">
          <p className="text-md text-muted-foreground">
            In your <Home className="w-5 h-5 inline-block mb-1" /> Homepage,
            you will be prompted with a daily metric log.
          </p>
          <div className="text-left pb-5 pointer-events-none">
            <MetricIsland
              metric={dummyMetric}
              isLoggedToday={false}
              className="bg-card"
            />
            <p className="text-md text-muted-foreground mt-3">
              You can then find both a weekly view of your metrics and useful
              correlations.
            </p>
            <MetricWeeklyView
              metric={dummyMetric}
              weekData={[3, 4, 0, 5, 4, 3, 4]}
              color="blue"
              hasAnyData={true}
              positiveCorrelations={[
                {
                  activity: {
                    id: "exercise",
                    title: "Exercise",
                    emoji: "🏃‍♂️",
                    measure: "minutes",
                  } as Activity,
                  correlation: 0.65,
                },
                {
                  activity: {
                    id: "meditation",
                    title: "Meditation",
                    emoji: "🧘‍♂️",
                    measure: "minutes",
                  } as Activity,
                  correlation: 0.45,
                },
              ]}
              className="bg-card"
            />
            <p className="text-md text-muted-foreground mt-3">
              Or an even more in-depth view on the
              <br />
              <img
                src={getCoachAvatar(aiCoachPersonality, "coachSmiling")}
                alt=""
                className="mb-1 inline-block h-6 w-6 object-contain"
              />{" "}
              Insights page.
            </p>
          </div>
        </div>
      </AppleLikePopover>
    </>
  );
};
