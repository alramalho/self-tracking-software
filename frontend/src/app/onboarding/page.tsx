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
import { AccountabilityStepCard } from "@/components/AccountabilityStepCard";
import { ProfileSetupDynamicUI } from "@/components/ProfileSetupDynamicUI";
import { useNotifications } from "@/hooks/useNotifications";
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
    setAttempted(true);
    posthog?.capture("onboarding-intro-complete", { skipped: false });
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
      <ProgressDots current={1} max={5} />
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
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture("onboarding-profile-setup-view");
  }, [posthog]);

  return (
    <div className="w-lg max-w-full mx-auto">
      <ProgressDots current={2} max={5} />
      <ProfileSetupDynamicUI
        onSubmit={() => {
          posthog?.capture("onboarding-profile-setup-complete", {
            skipped: false,
          });
          onNext();
        }}
      />

      <Button
        variant="ghost"
        className="w-full mt-6 underline"
        onClick={() => {
          posthog?.capture("onboarding-profile-setup-complete", {
            skipped: true,
          });
          onNext();
        }}
      >
        Skip for now (you won&apos;t be able to use our AI coach)
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
    <div className="w-lg max-w-full mx-auto">
      <ProgressDots current={3} max={5} />
      <PlanCreatorDynamicUI
        onNext={() => {
          posthog?.capture("onboarding-plan-creation-complete", {
            skipped: false,
          });
          onNext();
        }}
      />
      <Button
        variant="ghost"
        className="w-full mt-6 underline"
        onClick={() => {
          posthog?.capture("onboarding-plan-creation-complete", {
            skipped: true,
          });
          onNext();
        }}
      >
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
    <div className="w-lg max-w-full mx-auto">
      <ProgressDots current={4} max={5} />
      <PastWeekLoggingDynamicUI
        onNext={() => {
          posthog?.capture("onboarding-past-week-logging-complete", {
            skipped: false,
          });
          onNext();
        }}
      />
      <Button
        variant="ghost"
        className="w-full mt-6 underline"
        onClick={() => {
          posthog?.capture("onboarding-past-week-logging-complete", {
            skipped: true,
          });
          onNext();
        }}
      >
        Skip for now
      </Button>
    </div>
  );
}

function AccountabilityPartnerStep({
  onNext,
}: {
  onNext: (isLookingForAP: boolean) => void;
}) {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const queryClient = useQueryClient();
  const currentUserReceivedFriendRequests =
    currentUserQuery.data?.receivedFriendRequests;
  const { userPaidPlanType } = usePaidPlan();
  const currentUserSentFriendRequests =
    currentUserQuery.data?.sentFriendRequests;
  const router = useRouter();
  const pendingSentFriendRequests =
    currentUserSentFriendRequests?.filter(
      (request) => request.status == "pending"
    ) || [];

  const pendingReceivedFriendRequests =
    currentUserReceivedFriendRequests?.filter(
      (request) => request.status == "pending"
    ) || [];

  const api = useApiWithAuth();
  const { requestPermission: requestNotificationPermission } =
    useNotifications();
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture("onboarding-accountability-partner-view");
  }, [posthog]);

  const handleFinishClick = (lookingForAP: boolean) => {
    if (lookingForAP) {
      requestNotificationPermission();
    }
    try {
      api.post("/update-user", { looking_for_ap: lookingForAP });
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to save your preferences. Please try again later.");
    }

    posthog?.capture("onboarding-accountability-partner-complete", {
      skipped: false,
      $set: { is_looking_for_ap: lookingForAP },
    });

    currentUserQuery.refetch();
    onNext(lookingForAP);
  };

  return (
    <div className="space-y-6 w-full max-w-md mx-auto text-center">
      <ProgressDots current={5} max={5} />
      <ScanFace size={100} className="mx-auto mb-4 text-blue-500" />
      <h2 className="text-2xl font-bold mb-4">
        Lastly, are you interested in an accountability partner?
      </h2>
      <p className="text-gray-600 mb-2">
        Research shows this increases your chances of success by up to 95%!
      </p>
      <div className="flex gap-4 justify-center">
        <Button
          variant="outline"
          className="w-full bg-white"
          onClick={() => {
            handleFinishClick(false);
          }}
        >
          No
        </Button>
        <Button
          className="w-full"
          onClick={() => {
            handleFinishClick(true);
          }}
        >
          Yes
        </Button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const { useCurrentUserDataQuery, hasLoadedUserData } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserQuery;
  const [onboardingCompleted, setOnboardingCompleted] =
    useLocalStorage<boolean>("onboarding-completed", false);
  const [step, setStep] = useState(1);
  const router = useRouter();

  useEffect(() => {
    if (onboardingCompleted) {
      router.push("/");
      return;
    }

    if (hasLoadedUserData) {
      if (!userData?.user?.profile) {
        setStep(1);
      } else if (!userData?.plans?.length) {
        setStep(3);
      } else if (!userData?.activityEntries?.length) {
        setStep(4);
      } else if (!userData?.user?.looking_for_ap) {
        setStep(5);
      } else {
        onFinish(true);
      }
    }
  }, [hasLoadedUserData]);

  function nextStep() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    setStep(step + 1);
  }

  function onFinish(isLookingForAP: boolean) {
    setOnboardingCompleted(true);
    hotToast.success(
      "You're all set! You can now start using the app. Any question just use the feedback button in the bottom right corner.",
      { duration: 8000 }
    );
    if (isLookingForAP) {
      router.push("/looking-for-ap");
    } else {
      router.push("/");
    }
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return <WelcomeStep onNext={nextStep} />;
      case 2:
        return <ProfileSetupStep onNext={nextStep} />;
      case 3:
        return <PlanCreationStep onNext={nextStep} />;
      case 4:
        return <PastWeekLoggingStep onNext={nextStep} />;
      default:
        return <AccountabilityPartnerStep onNext={onFinish} />;
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
