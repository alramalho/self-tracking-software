"use client";

import AppleLikePopover from "@/components/AppleLikePopover";
import { CoachOverviewCard } from "@/components/CoachOverviewCard";
import { MetricIsland } from "@/components/MetricIsland";
import { MetricWeeklyView } from "@/components/MetricWeeklyView";
import { PlanProgressCard } from "@/components/PlanProgressCard";
import { PlanWeekDisplay } from "@/components/PlanWeekDisplay";
import { Button } from "@/components/ui/button";
import { CompletePlan } from "@/contexts/plans";
import { PlanProgressData } from "@/contexts/plans-progress";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { Activity, ActivityEntry } from "@tsw/prisma";
import {
  ChartArea,
  CheckCircle,
  Home,
  LandPlot,
  MoveRight,
  NotepadText,
  Route,
  ScanFace,
  Send,
} from "lucide-react";
import React, { useState } from "react";
import { withFadeUpAnimation } from "../../lib";
import { useOnboarding } from "../OnboardingContext";

// Dummy data for coach overview demo
const dummyCoachPlan = {
  id: "demo-coach-plan",
  goal: "Read 30 minutes daily",
  emoji: "📚",
  outlineType: "TIMES_PER_WEEK",
  timesPerWeek: 7,
  activities: [{ id: "reading-activity" }],
  coachNotes:
    "You're making great progress! I've noticed you're more consistent on weekdays. Let's try to maintain momentum on weekends too.",
  suggestedByCoachAt: new Date(),
  currentWeekState: "ON_TRACK",
} as Partial<CompletePlan>;
const dummyCoachPlanWithSuggestions = {
  ...dummyCoachPlan,
  coachNotes:
    "Great progress reading 5 days last week! Let's adjust to 5 days per week for now - " +
    "this feels more achievable while we work towards daily reading. What do you think?",
  coachSuggestedTimesPerWeek: 5,
  suggestedByCoachAt: new Date().toISOString(),
};

const dummyActivities = [
  {
    id: "reading-activity",
    title: "Reading",
    emoji: "📚",
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
    emoji: dummyCoachPlan.emoji || "🔥",
    goal: dummyCoachPlan.goal || "Read 30 minutes daily",
    id: dummyCoachPlan.id || "demo-coach-plan",
    type: dummyCoachPlan.outlineType || "TIMES_PER_WEEK",
  },
  planId: dummyCoachPlan.id || "demo-coach-plan",
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
          className={`w-12 h-12 rounded-lg flex items-center justify-center  bg-gray-100`}
        >
          {icon}
        </div>
        <div className="flex flex-col gap-0 w-full my-auto">
          <p className={`text-md font-normal text-gray-600 justify-between`}>
            {title}
          </p>
          {onClick && (
            <span
              onClick={onClick}
              className="p-0 self-start flex items-center gap-2 text-gray-400"
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

const AIPartnerFinder = () => {
  const { completeStep } = useOnboarding();
  const [planStatePopoverDemoOpen, setPlanStatePopoverDemoOpen] =
    useState(false);
  const [planCreationPopoverDemoOpen, setPlanCreationPopoverDemoOpen] =
    useState(false);
  const [metricAnalysisPopoverDemoOpen, setMetricAnalysisPopoverDemoOpen] =
    useState(false);

  const { setShowUpgradePopover } = useUpgrade();
  const { isUserPremium } = usePaidPlan();

  const dummyAchievement = {
    streak: 3,
  };

  return (
    <div className="w-full max-w-lg space-y-2">
      <div className="flex flex-col items-center gap-4 text-center pt-0">
        <div className="flex flex-col items-center gap-2">
          <img
            src="/images/jarvis_logo_blue_transparent.png"
            className="w-24 h-24"
          />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-gray-900">
            Meet Oli,
            <br /> your new personal coach
          </h2>
        </div>
        <p className="text-md text-gray-600">
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
          // TODO: FIX THIS PART
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
      <p className="text-md text-gray-600 w-full text-center py-2">
        And many more features to come!
      </p>

      <Button
        size="lg"
        className="w-full mt-8 rounded-xl"
        onClick={() => {
          if (isUserPremium) {
            completeStep("ai-partner-finder", {}, { complete: true });
          } else {
            setShowUpgradePopover(true);
          }
        }}
      >
        {isUserPremium ? (
          <>
            <CheckCircle className="mr-2  w-4 h-4" />
            <span>Continue</span>{" "}
          </>
        ) : (
          <>
            <span>Start trial</span> <MoveRight className="ml-3 w-4 h-4" />
          </>
        )}{" "}
      </Button>

      <AppleLikePopover
        onClose={() => setPlanStatePopoverDemoOpen(false)}
        open={planStatePopoverDemoOpen}
      >
        <div className="flex flex-col gap-4 pt-3 text-left space-y-2">
          <p className="text-md text-gray-600 font-semibold">
            In your <Home className="w-5 h-5 inline-block mb-1" /> Homepage, Oli
            provides you an overview of your plan and current week status.
          </p>
          <div className="w-full text-left">
            <PlanProgressCard
              plan={dummyCoachPlan as any}
              weeks={dummyPlanProgressData.weeks}
              achievement={dummyAchievement}
              isCoached={true}
              isExpanded={true}
              isDemo={true}
            />
          </div>

          <p className="text-md text-gray-600 font-semibold">
            Or if you want an in-depth view with custom metrics, you can check
            the <br />
            <ChartArea className="w-5 h-5 inline-block mb-1" /> Plans page.
          </p>

          <div className="text-left">
            <CoachOverviewCard
              selectedPlan={dummyCoachPlan as any}
              activities={dummyActivities}
              isDemo={true}
            />
          </div>

          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white border border-gray-200">
            <PlanWeekDisplay
              title={
                <div className="flex justify-between items-center w-full">
                  <span className="text-lg font-semibold">Current week</span>
                  <span className="text-sm text-gray-500">17-23 Jul</span>
                </div>
              }
              plan={dummyCoachPlan as any}
              date={new Date()}
              planProgress={dummyPlanProgressData as any}
            />
          </div>
        </div>
      </AppleLikePopover>
      <AppleLikePopover
        onClose={() => setPlanCreationPopoverDemoOpen(false)}
        open={planCreationPopoverDemoOpen}
      >
        <div className="flex flex-col gap-4 pt-3 ">
          <p className="text-md text-gray-600 font-semibold text-center">
            Oli will make sure you&apos;re grounded in achievable goals! You can
            find weekly notes like this on the{" "}
            <ChartArea className="w-5 h-5 inline-block mb-1" /> Plans page:
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
          <p className="text-md text-gray-600">
            In your <Home className="w-5 h-5 inline-block mb-1" /> Homepage, you
            will be prompted with a daily metric log, like this
          </p>
          <div className="text-left pb-5 pointer-events-none">
            <MetricIsland
              metric={dummyMetric}
              isLoggedToday={false}
              className="bg-white"
            />
            <p className="text-md text-gray-600 mt-3">
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
              className="bg-white"
            />
            <p className="text-md text-gray-600 mt-3">
              Or an even more in-depth view on the
              <br /> <ScanFace className="w-5 h-5 inline-block mb-1" /> Insights
              page!
            </p>
          </div>
        </div>
      </AppleLikePopover>
    </div>
  );
};

export default withFadeUpAnimation(AIPartnerFinder);
