/* eslint-disable react-refresh/only-export-components */
"use client";
import AppleLikePopover from "@/components/AppleLikePopover";
import { CoachOverviewCard } from "@/components/CoachOverviewCard";
import { MetricWeeklyView } from "@/components/MetricWeeklyView";
import { PlanProgressCard } from "@/components/PlanProgressCard";
import { PlanWeekDisplay } from "@/components/PlanWeekDisplay";
import { type CompletePlan } from "@/contexts/plans";
import { type PlanProgressData } from "@/contexts/plans-progress";
import { type Activity, type ActivityEntry } from "@tsw/prisma";
import {
  BarChart3,
  Home,
  LandPlot,
  MoveRight,
  NotepadText,
  Route,
  ScanFace,
  Send,
} from "lucide-react";
import React, { useState } from "react";
import { MetricIsland } from "./MetricIsland";

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

const dummyCoachPlan = {
  id: DEMO_PLAN_ID,
  goal: DEMO_PLAN_GOAL,
  emoji: DEMO_PLAN_EMOJI,
  outlineType: "TIMES_PER_WEEK",
  timesPerWeek: 7,
  activities: [{ id: "reading-activity" }],
  coachNotes:
    "You're making great progress! I've noticed you're more consistent on weekdays. Let's try to maintain momentum on weekends too.",
  suggestedByCoachAt: new Date(),
  currentWeekState: "ON_TRACK",
  progress: dummyPlanProgressData,
} as Partial<CompletePlan>;

const dummyCoachPlanWithSuggestions = {
  ...dummyCoachPlan,
  coachNotes:
    "Great progress reading 5 days last week! Let's adjust to 5 days per week for now - " +
    "this feels more achievable while we work towards daily reading. What do you think?",
  coachSuggestedTimesPerWeek: 5,
  suggestedByCoachAt: new Date().toISOString(),
};

const CardItem = ({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
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
          {onClick && (
            <span
              onClick={onClick}
              className="p-0 self-start flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground cursor-pointer"
            >
              <span className="text-sm font-medium font-mono">View demo</span>
              <MoveRight className="w-6 h-6" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

interface AICoachFeaturePreviewProps {
  children?: React.ReactNode;
}

export const AICoachFeaturePreview: React.FC<AICoachFeaturePreviewProps> = ({
  children,
}) => {
  const [planStatePopoverDemoOpen, setPlanStatePopoverDemoOpen] =
    useState(false);
  const [planCreationPopoverDemoOpen, setPlanCreationPopoverDemoOpen] =
    useState(false);
  const [metricAnalysisPopoverDemoOpen, setMetricAnalysisPopoverDemoOpen] =
    useState(false);

  const dummyAchievement = {
    streak: 3,
  };

  return (
    <>
      <div className="w-full max-w-lg space-y-2">
        <div className="flex flex-col items-center gap-4 text-center pt-0">
          <div className="flex flex-col items-center gap-2">
            <img
              src="/images/jarvis_logo_blue_transparent.png"
              className="w-24 h-24"
            />
            <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
              Meet Oli,
              <br /> your new personal coach
            </h2>
          </div>
          <p className="text-md text-muted-foreground">
            Oli is designed to help you stay on track and motivated.
            <br />
            Here&apos;s some things he can do:
          </p>
        </div>
        <div className="space-y-0">
          <CardItem
            icon={<LandPlot className="w-8 h-8 text-blue-500" />}
            title="Keeping track of your plan state"
            onClick={() => setPlanStatePopoverDemoOpen(true)}
          />
          <CardItem
            icon={<Send className="w-8 h-8 text-blue-500" />}
            title="Outreach to you several times a week"
          />
          <CardItem
            icon={<Route className="w-8 h-8 text-blue-500" />}
            title="Weekly adapting your plan based on achievement"
            onClick={() => setPlanCreationPopoverDemoOpen(true)}
          />
          <CardItem
            icon={<NotepadText className="w-8 h-8 text-blue-500" />}
            title="Providing insightful correlations"
            onClick={() => setMetricAnalysisPopoverDemoOpen(true)}
          />
        </div>
        <p className="text-md text-muted-foreground w-full text-center py-2">
          And many more features to come!
        </p>

        {children}
      </div>

      <AppleLikePopover
        onClose={() => setPlanStatePopoverDemoOpen(false)}
        open={planStatePopoverDemoOpen}
      >
        <div className="flex flex-col gap-4 pt-3 text-left space-y-2">
          <p className="text-md text-muted-foreground font-semibold">
            In your <Home className="w-5 h-5 inline-block mb-1" /> Homepage, Oli
            provides you an overview of your plan and current week status.
          </p>
          <div className="w-full text-left">
            <PlanProgressCard
              plan={dummyCoachPlan as any}
              weeks={dummyPlanProgressData.weeks}
              achievement={dummyAchievement}
              isExpanded={true}
              isDemo={true}
            />
          </div>

          <p className="text-md text-muted-foreground font-semibold">
            Or if you want an in-depth view with custom metrics, you can check
            the <br />
            <BarChart3 className="w-5 h-5 inline-block mb-1" /> Plans page.
          </p>

          <div className="text-left">
            <CoachOverviewCard
              selectedPlan={dummyCoachPlan as any}
              activities={dummyActivities}
              isDemo={true}
            />
          </div>

          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-card border border-border">
            <PlanWeekDisplay
              title={
                <div className="flex justify-between items-center w-full">
                  <span className="text-lg font-semibold">Current week</span>
                  <span className="text-sm text-gray-500">17-23 Jul</span>
                </div>
              }
              plan={dummyCoachPlan as any}
              date={new Date()}
            />
          </div>
        </div>
      </AppleLikePopover>
      <AppleLikePopover
        onClose={() => setPlanCreationPopoverDemoOpen(false)}
        open={planCreationPopoverDemoOpen}
      >
        <div className="flex flex-col gap-4 pt-3 ">
          <p className="text-md text-muted-foreground font-semibold text-center">
            Oli will make sure you&apos;re grounded in achievable goals! You can
            find weekly notes like this on the{" "}
            <BarChart3 className="w-5 h-5 inline-block mb-1" /> Plans page:
          </p>
          <div className="text-left pb-5">
            <CoachOverviewCard
              selectedPlan={dummyCoachPlanWithSuggestions as any}
              activities={dummyActivities}
              isDemo={true}
            />
          </div>
        </div>
      </AppleLikePopover>
      <AppleLikePopover
        onClose={() => setMetricAnalysisPopoverDemoOpen(false)}
        open={metricAnalysisPopoverDemoOpen}
      >
        <div className="flex flex-col gap-2 mt-6">
          <p className="text-md text-muted-foreground">
            In your <Home className="w-5 h-5 inline-block mb-1" /> Homepage, you
            will be prompted with a daily metric log, like this
          </p>
          <div className="text-left pb-5 pointer-events-none">
            <MetricIsland
              metric={dummyMetric}
              isLoggedToday={false}
              className="bg-card"
            />
            <p className="text-md text-muted-foreground mt-3">
              You can then find both a weekly view of your metrics as well as a
              correlation analysis.
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
              <br /> <ScanFace className="w-5 h-5 inline-block mb-1" /> Insights
              page!
            </p>
          </div>
        </div>
      </AppleLikePopover>
    </>
  );
};
