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

function AccountabilityQuestionStep({
  onResult,
}: {
  onResult: (wantsPartner: boolean) => void;
}) {

  return (
    <div className="space-y-6 w-full max-w-md mx-auto text-center">
      <ProgressDots current={5} max={5} />
      <ScanFace size={100} className="mx-auto mb-4 text-blue-500" />
      <h2 className="text-2xl font-bold mb-4">
        Are you looking for an accountability partner?
      </h2>
      <p className="text-gray-600 mb-6">
        Having an accountability partner increases your chances of success by up
        to 95%!
      </p>
      <div className="flex gap-4 justify-center">
        <Button
          className="w-full"
          onClick={() => {
            onResult(true);
          }}
        >
          Yes, find me a partner!
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            onResult(false);
          }}
        >
          No, not right now
        </Button>
      </div>
    </div>
  );
}

function AccountabilityPartnerStep({ onNext }: { onNext: () => void }) {
  const [wantsPartner, setWantsPartner] = useState<boolean | undefined>(
    undefined
  );
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

  const { data: userData } = useCurrentUserDataQuery();
  const currentUser = userData?.user;
  const { isSupported: isShareSupported, share } = useShare();
  const api = useApiWithAuth();
  const [copied, copyToClipboard] = useClipboard();
  const { setShowUpgradePopover } = useUpgrade();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountabilityPopoverOpen, setAccountabilityPopoverOpen] =
    useState(false);
  const [usersInQueue, setUsersInQueue] = useState<UserSearchResult[]>([]);
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture("onboarding-accountability-partner-view");
  }, [posthog]);

  useEffect(() => {
    currentUserQuery.refetch();
  }, []);

  const { data: otherProfiles } = useQuery<OtherProfile[]>({
    queryKey: [
      "otherProfiles",
      pendingSentFriendRequests,
      pendingReceivedFriendRequests,
    ],
    queryFn: async () => {
      const profileIdsToCheck = [
        ...(pendingSentFriendRequests?.map((request) => request.recipient_id) ||
          []),
        ...(pendingReceivedFriendRequests?.map(
          (request) => request.sender_id
        ) || []),
      ];
      if (!profileIdsToCheck.length) return [];

      const profiles = await Promise.all(
        profileIdsToCheck.map((id) =>
          api.get(`/get-user-profile/${id}`).then((res) => res.data)
        )
      );
      return profiles;
    },
  });

  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await api.post(`/accept-friend-request/${requestId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserData"] });
      queryClient.invalidateQueries({ queryKey: ["otherProfiles"] });
    },
  });

  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await api.post(`/reject-friend-request/${requestId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserData"] });
      queryClient.invalidateQueries({ queryKey: ["otherProfiles"] });
    },
  });

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequestMutation.mutateAsync(requestId);
      currentUserQuery.refetch();
      toast.success("Friend request accepted!");
    } catch (error) {
      console.error("Error accepting friend request:", error);
      toast.error("Failed to accept friend request");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectFriendRequestMutation.mutateAsync(requestId);
      toast.success("Friend request rejected");
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      toast.error("Failed to reject friend request");
    }
  };

  const handleShareReferralLink = async () => {
    const link = `https://app.tracking.so/join/${userData?.user?.username}`;

    try {
      if (isShareSupported) {
        const success = await share(link);
        if (!success) throw new Error("Failed to share");
      } else {
        const success = await copyToClipboard(link);
        if (!success) throw new Error("Failed to copy");
      }
    } catch (error) {
      console.error("Error sharing referral link:", error);
      toast.error("Failed to share referral link. Maybe you cancelled it?");
    }
  };

  const toggleUserInQueue = (user: UserSearchResult) => {
    setUsersInQueue((prev) =>
      prev.includes(user)
        ? prev.filter((u) => u.user_id !== user.user_id)
        : [...prev, user]
    );
  };
  useEffect(() => {
    console.log("rendered");
  }, []);

  const handleFinishClick = () => {
    // Show accountability popover if user has no friends and is on free plan
    posthog?.capture("onboarding-accountability-partner-complete", {
      skipped: false,
      wants_partner: wantsPartner,
    });
    onNext();
  };

  useEffect(() => {
    if (wantsPartner == false) {
      handleFinishClick()
    }
  }, [wantsPartner]);

  if (wantsPartner === undefined) {
    return (
      <AccountabilityQuestionStep
        onResult={(result) => {
          api.post("/update-user", { looking_for_ap: result });
          setWantsPartner(result)
        }}
      />
    );
  }

  return (
    <div className="space-y-6 w-full max-w-md mx-auto">
      <ProgressDots current={5} max={5} />
      <div className="text-center">
        <ScanFace size={100} className="mx-auto mb-4 text-blue-500" />
        <h2 className="text-xl font-bold mb-4">
          Great! Let&apos;s find you an accountability partner.
        </h2>
        <p className="text-gray-600 mb-6">
          You have several options to get started:
        </p>
      </div>

      <div className="space-y-4">
        <AccountabilityStepCard
          icon={<UserPlus size={30} />}
          title="Invite a friend to the app"
          description="Share your invite link and both join the app free of cost."
          buttonText="Share Invite"
          onClick={handleShareReferralLink}
          secondaryText="Search for a friend"
          secondaryOnClick={() => setSearchOpen(true)}
          color="blue"
        />
        <AccountabilityStepCard
          icon={<Search size={30} />}
          title="Find someone in our community"
          description="Find someone who will help you stay on track"
          buttonText="Open AP Recommendations"
          onClick={() => {
            router.push("/looking-for-ap");
          }}
          color="blue"
        />
        <div>
          <AccountabilityStepCard
            icon={<ScanFace size={30} />}
            title="Use our AI coach"
            description="Get personalized suggestions and support from our AI coach"
            buttonText="Try free"
            onClick={() => setShowUpgradePopover(true)}
            color="gradient"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 items-center">
        <div className="text-7xl font-bold tracking-tighter">
          {currentUser?.friend_ids?.length}
        </div>
        <div className="text-sm uppercase text-muted-foreground">
          Friend count
        </div>
      </div>

      <div className="flex flex-col gap-2 items-start ring-2 ring-gray-600/20 rounded-2xl p-4">
        <div className="text-sm uppercase text-muted-foreground flex flex-row gap-2 items-center">
          <Inbox size={16} />
          Friend requests
        </div>
        {!pendingReceivedFriendRequests.length &&
          !pendingSentFriendRequests.length && (
            <span className="text-gray-400">
              Your friend requests will appear here,{" "}
              <a
                onClick={handleShareReferralLink}
                className="underline cursor-pointer"
              >
                share them!
              </a>
            </span>
          )}

        {pendingReceivedFriendRequests.length > 0 && otherProfiles && (
          <div className="flex flex-col gap-2 w-full">
            {pendingReceivedFriendRequests.map((request, index) => {
              const sender = otherProfiles.find(
                (profile) => profile.user?.id === request.sender_id
              );
              if (!sender) return null;

              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between w-full p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage
                        src={sender.user?.picture}
                        alt={sender.user?.name}
                      />
                      <AvatarFallback>{sender.user?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{sender.user?.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white text-green-600 hover:bg-green-600 hover:text-white"
                      onClick={() => handleAcceptRequest(request.id)}
                      disabled={
                        acceptFriendRequestMutation.isPending ||
                        rejectFriendRequestMutation.isPending
                      }
                    >
                      {acceptFriendRequestMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Accept"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="bg-white text-red-600 hover:bg-red-600 hover:text-white"
                      onClick={() => handleRejectRequest(request.id)}
                      disabled={
                        acceptFriendRequestMutation.isPending ||
                        rejectFriendRequestMutation.isPending
                      }
                    >
                      {rejectFriendRequestMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Reject"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pendingSentFriendRequests && pendingSentFriendRequests.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            {pendingSentFriendRequests.map((request) => {
              const recipient = otherProfiles?.find(
                (sender) => sender.user?.id === request.recipient_id
              );
              if (!recipient) return null;

              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between w-full p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={recipient.user?.picture} />
                      <AvatarFallback>
                        {recipient.user?.name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{recipient.user?.name}</span>
                  </div>
                  <span className="text-gray-400">Sent</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Button className="w-full mt-6" onClick={handleFinishClick}>
        Finish
      </Button>
      <Button
        variant="ghost"
        className="w-full mt-6 underline"
        onClick={() => {
          posthog?.capture("onboarding-accountability-partner-complete", {
            skipped: true,
          });
          onNext();
        }}
      >
        Skip for now (up to 95% less chances of success)
      </Button>

      <AppleLikePopover open={searchOpen} onClose={() => setSearchOpen(false)}>
        <div className="w-full flex flex-row gap-2">
          {usersInQueue.map((user, index) => (
            <Avatar className="w-10 h-10" key={index}>
              <AvatarImage src={user.picture} />
              <AvatarFallback>{user.name?.[0]}</AvatarFallback>
            </Avatar>
          ))}
        </div>

        {usersInQueue.length > 0 && (
          <Button
            variant="outline"
            className="w-full mt-6"
            onClick={() => {
              usersInQueue.forEach((user) => {
                api.post(`/send-friend-request/${user.user_id}`);
              });
              setUsersInQueue([]);
              setSearchOpen(false);
              currentUserQuery.refetch();
            }}
          >
            <Send size={16} className="mr-2" />
            <span className="text-sm uppercase">Send friend requests</span>
          </Button>
        )}
        <UserSearch onUserClick={(user) => toggleUserInQueue(user)} />
      </AppleLikePopover>

      {/* <AppleLikePopover
        open={accountabilityPopoverOpen}
        onClose={() => setAccountabilityPopoverOpen(false)}
      >
        <div className="p-4 space-y-4 text-md text-gray-600">
          <h3 className="text-xl font-bold text-gray-800">👋 Hey there!</h3>
          <p>
            It seems you&apos;re not interested in having anyone else in this
            tracking journey with you.
          </p>
          <p>
            That&apos;s a pity, because it means you will likely be dropping out
            soon 😔
          </p>
          <p>
            We&apos;re serious about your success though, so we&apos;d like to
            offer you an extended trial of our private AI coach. Think of it as
            a light accountability partner.
          </p>
          <p>
            During this time you can always invite a friend to the app to fully
            unlock the free tier, or cancel if it doesn&apos;t suit your needs.
          </p>
          <p>How does that sound?</p>
          <Coffee />
          <Link
            href={"https://buy.stripe.com/cN24jef3LgbnchyaEK"}
            target="_blank"
          >
            <div className="flex gap-3 mt-4">
              <Button className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 w-full rounded-xl">
                Yes, let&apos; do it
              </Button>
            </div>
          </Link>
        </div>
      </AppleLikePopover> */}
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
    if (hasLoadedUserData && userData?.plans && userData?.plans.length > 0) {
      if (userData?.activities && userData?.activities.length > 0) {
        setStep(5);
      } else {
        setStep(4);
      }
    }
  }, [hasLoadedUserData]);

  const renderStep = () => {
    switch (step) {
      case 1:
        return <WelcomeStep onNext={() => setStep(2)} />;
      case 2:
        return <ProfileSetupStep onNext={() => setStep(3)} />;
      case 3:
        return <PlanCreationStep onNext={() => setStep(4)} />;
      case 4:
        return <PastWeekLoggingStep onNext={() => setStep(5)} />;
      default:
        return (
          <AccountabilityPartnerStep
            onNext={() => {
              setOnboardingCompleted(true);
              router.push("/");
              hotToast.success(
                "You're all set! You can now start using the app. Any question just use the feedback button in the bottom right corner.",
                { duration: 8000 }
              );
            }}
          />
        );
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
