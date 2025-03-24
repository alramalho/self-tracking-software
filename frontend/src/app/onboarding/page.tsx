"use client";

import { Button } from "@/components/ui/button";
import { useState, useCallback, useEffect } from "react";
import {
  Badge,
  ScanFace,
  UserPlus,
  Search,
  Inbox,
  Send,
  Loader2,
  Check,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DynamicUISuggester } from "@/components/DynamicUISuggester";
import { useApiWithAuth } from "@/api";
import { PlanCreatorDynamicUI } from "@/components/PlanCreatorDynamicUI";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { toast as hotToast } from "react-hot-toast";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useShare } from "@/hooks/useShare";
import { useClipboard } from "@/hooks/useClipboard";
import { Coffee, UpgradePopover } from "@/components/UpgradePopover";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import UserSearch, { UserSearchResult } from "@/components/UserSearch";
import AppleLikePopover from "@/components/AppleLikePopover";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { usePostHog } from "posthog-js/react";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import Link from "next/link";
import { PastWeekLoggingDynamicUI } from "@/components/PastWeekLoggingDynamicUI";
import { ProgressDots } from "@/components/ProgressDots";
import { useLocalStorage } from "@/hooks/useLocalStorage";
type OtherProfile = {
  user: {
    id: string;
    name: string;
    picture?: string;
  };
};

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const user = currentUserQuery.data?.user;
  const [profile, setProfile] = useState(false);
  const [plan, setPlan] = useState(false);
  const [partner, setPartner] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture("onboarding-intro-view");
  }, [posthog]);

  const handleCheckedChange =
    (setter: (value: boolean) => void) => (checked: boolean) => {
      setter(checked);
    };

  const handleContinue = () => {
    console.log("handleContinue");
    setAttempted(true);
    // if (profile && plan && partner) {
    onNext();
    // }
  };
  const waveVariants = {
    initial: { rotate: 0 },
    wave: {
      rotate: [0, 25, -15, 25, -15, 0],
      transition: {
        delay: 2,
        duration: 1.5,
        times: [0, 0.2, 0.4, 0.6, 0.8, 1],
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className="space-y-6 w-full max-w-md mx-auto">
      <ProgressDots current={1} max={4} />
      <div className="text-center">
        <div className="relative w-fit mx-auto">
          <ScanFace size={100} className="mx-auto mb-4 text-blue-500" />
          <motion.span
            className="absolute bottom-[9px] left-[-40px] text-5xl"
            initial="initial"
            animate="wave"
            variants={waveVariants}
            style={{ transformOrigin: "90% 90%" }}
          >
            👋
          </motion.span>
        </div>
        <p className="text-3xl font-bold mb-4">
          Welcome, {user?.name?.split(" ")[0]}!{" "}
        </p>
        <p className="text-lg font-medium mb-4">
          <span className="text-blue-500 break-normal text-nowrap">
            tracking.so<span className="text-blue-300">ftware</span>
          </span>{" "}
          is the place to start tracking yourself, and achieve your goals.
        </p>
        <p className="text-gray-600 font-medium mb-6">
          Ready to start your journey?
        </p>
      </div>

      {/* <div className="space-y-4">
        <div className="space-y-2">
          <div className={`flex items-start space-x-3`}>
            <Checkbox
              id="profile"
              checked={profile}
              onCheckedChange={handleCheckedChange(setProfile)}
            />
            <label
              htmlFor="profile"
              className="text-md leading-tight cursor-pointer"
            >
              Create a user profile with vision and anti-vision. <br></br>
              <span className="text-gray-500 text-sm">
                (this increases your chances of success by 25%)
              </span>
            </label>
          </div>
          {attempted && !profile && (
            <p className="text-sm text-red-500 pl-7">This field is mandatory</p>
          )}
        </div>

        <div className="space-y-2">
          <div className={`flex items-start space-x-3`}>
            <Checkbox
              id="plan"
              checked={plan}
              onCheckedChange={handleCheckedChange(setPlan)}
            />
            <label
              htmlFor="plan"
              className="text-md leading-tight cursor-pointer"
            >
              Create your own actionable plan. <br></br>
              <span className="text-gray-500 text-sm">
                (this increases your chances of success by 55%)
              </span>
            </label>
          </div>
          {attempted && !plan && (
            <p className="text-sm text-red-500 pl-7">This field is mandatory</p>
          )}
        </div>

        <div className="space-y-2">
          <div className={`flex items-start space-x-3`}>
            <Checkbox
              id="partner"
              checked={partner}
              onCheckedChange={handleCheckedChange(setPartner)}
            />
            <label
              htmlFor="partner"
              className="text-md leading-tight cursor-pointer"
            >
              Get you an accountability partner. <br></br>
              <span className="text-gray-500 text-sm">
                (this increases your chances of success by 95%)
              </span>
            </label>
          </div>
          {attempted && !partner && (
            <p className="text-sm text-red-500 pl-7">This field is mandatory</p>
          )}
        </div>
      </div> */}

      <Button className="w-full mt-6" onClick={handleContinue}>
        Let&apos;s go!
      </Button>
    </div>
  );
}

function ProfileSetupStep({ onNext }: { onNext: () => void }) {
  const questionsChecks = {
    "Who you are (your age, occupation, etc.)": "What does the user do",
    "What do you want to achieve (your vision)":
      "Does the user share any thoughts about their aspirations?",
  };
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);
  const api = useApiWithAuth();
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture("onboarding-profile-setup-view");
  }, [posthog]);

  const renderChildrenContent = useCallback(
    (data: { question_checks: Record<string, boolean>; message: string }) => (
      <div>
        <Button
          disabled={!allQuestionsAnswered}
          className="w-full"
          onClick={() => {
            posthog?.capture("onboarding-profile-setup-complete");
            onNext();
          }}
        >
          Next
        </Button>
      </div>
    ),
    [allQuestionsAnswered, onNext]
  );

  return (
    <div className="max-w-lg mx-auto">
      <ProgressDots current={2} max={4} />
      <DynamicUISuggester<{
        question_checks: Record<string, boolean>;
        message: string;
      }>
        id="profile-setup"
        questionPrefix="I'd like to know"
        initialMessage="Great! Now, tell me a bit about yourself."
        placeholder="Voice messages are better suited for this step"
        questionsChecks={questionsChecks}
        onSubmit={async (text) => {
          const response = await api.post(
            "/ai/update-user-profile-from-questions",
            {
              message: text,
              question_checks: questionsChecks,
            }
          );

          setAllQuestionsAnswered(
            Object.values(response.data.question_checks).every((value) => value)
          );

          return response.data;
        }}
        renderChildren={renderChildrenContent}
      />
      <Button variant="ghost" className="w-full mt-6" onClick={() => {
        posthog?.capture("onboarding-profile-setup-skipped");
        onNext();
      }}>
        Skip for now (you won&apos; be able to use our AI coach)
      </Button>
    </div>
  );
}

function PlanCreationStep({ onNext }: { onNext: () => void }) {
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture("onboarding-plan-creation-view");
  }, [posthog]);

  return (
    <div className="max-w-lg mx-auto">
      <ProgressDots current={3} max={4} />
      <PlanCreatorDynamicUI onNext={() => {
        posthog?.capture("onboarding-plan-creation-complete");
        onNext();
      }} />
      <Button variant="ghost" className="w-full mt-6" onClick={() => {
        posthog?.capture("onboarding-plan-creation-skipped");
        onNext();
      }}>
        Skip for now (less 55% chance of success)
      </Button>
    </div>
  );
}

function PastWeekLoggingStep({ onNext }: { onNext: () => void }) {
  const posthog = usePostHog();
  

  useEffect(() => {
    posthog?.capture("onboarding-past-week-logging-view");
  }, [posthog]);

  return (
    <div className="max-w-lg mx-auto">
      <ProgressDots current={4} max={4} />
      <PastWeekLoggingDynamicUI onNext={() => {
        posthog?.capture("onboarding-past-week-logging-complete");
        onNext();
      }} />
      <Button variant="ghost" className="w-full mt-6" onClick={() => {
        posthog?.capture("onboarding-past-week-logging-skipped");
        onNext();
      }}>
        Skip for now
      </Button>
    </div>
  );
}

export default function OnboardingPage() {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const [onboardingCompleted, setOnboardingCompleted] = useLocalStorage<boolean>("onboarding-completed", false);
  const [step, setStep] = useState(1);
  const router = useRouter();


  const renderStep = () => {
    switch (step) {
      case 1:
        return <WelcomeStep onNext={() => setStep(2)} />;
      case 2:
        return <ProfileSetupStep onNext={() => setStep(3)} />;
      case 2:
        return <PlanCreationStep onNext={() => setStep(4)} />;
      default:
        return <PastWeekLoggingStep onNext={() => {
          setOnboardingCompleted(true);
          router.push("/");
          hotToast.success("You're all set! You can now start using the app. Any question just use the feedback button in the bottom right corner.");
        }} />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-50 z-[51] overflow-y-auto
          [background-image:linear-gradient(#eaedf1_1px,transparent_1px),linear-gradient(to_right,#eef0f3_1px,#f8fafc_1px)] 
      [background-size:20px_20px] flex flex-col items-center justify-center p-4"
    >
      <div className="h-full w-full" id="onboarding-page">
        <div className="min-h-full flex flex-col items-center p-4 max-w-4xl mx-auto">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
