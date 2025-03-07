"use client";

import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import {
  Link,
  Badge,
  ScanFace,
  UserPlus,
  Search,
  Inbox,
  Send,
  Loader2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DynamicUISuggester } from "@/components/DynamicUISuggester";
import { useApiWithAuth } from "@/api";
import { PlanCreatorDynamicUI } from "@/components/PlanCreatorDynamicUI";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {toast as hotToast} from "react-hot-toast";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useShare } from "@/hooks/useShare";
import { useClipboard } from "@/hooks/useClipboard";
import { UpgradePopover } from "@/components/UpgradePopover";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useMutation } from "@tanstack/react-query";

type SenderProfile = {
  user: {
    id: string;
    name: string;
    picture?: string;
  };
};

function IntroStep({ onNext }: { onNext: () => void }) {
  const [profile, setProfile] = useState(false);
  const [plan, setPlan] = useState(false);
  const [partner, setPartner] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const handleCheckedChange =
    (setter: (value: boolean) => void) => (checked: boolean) => {
      setter(checked);
    };

  const handleContinue = () => {
    setAttempted(true);
    if (profile && plan && partner) {
      onNext();
    }
  };

  return (
    <div className="space-y-6 w-full max-w-md mx-auto">
      <div className="text-center">
        <ScanFace size={100} className="mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-4">
          Our goal is helping you be more consistent. <br /> We&apos;re serious
          about that, now are you?
        </h2>
        <p className="text-gray-600 mb-6">
          Here&apos;s what we&apos;ll help you go through now
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className={`flex items-start space-x-3`}>
            <Checkbox
              id="profile"
              checked={profile}
              onCheckedChange={handleCheckedChange(setProfile)}
            />
            <label
              htmlFor="profile"
              className="text-sm leading-tight cursor-pointer"
            >
              Create a user profile with vision and anti-vision (25% increased
              chances of success)
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
              className="text-sm leading-tight cursor-pointer"
            >
              Create your own actionable plan (55% chance increase)
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
              className="text-sm leading-tight cursor-pointer"
            >
              Get you an accountability partner (95% chance increase)
            </label>
          </div>
          {attempted && !partner && (
            <p className="text-sm text-red-500 pl-7">This field is mandatory</p>
          )}
        </div>
      </div>

      <Button className="w-full mt-6" onClick={handleContinue}>
        I understand, let&apos;s do it
      </Button>
    </div>
  );
}

function SecondStep({ onNext }: { onNext: () => void }) {
  const questionsChecks = {
    "What do you do": "What does the user do",
    "Your vision for yourself (who do you want to become)":
      "The user ideal vision for himself",
    "Your anti-vision": "The user ideal anti-vision for himself",
  };
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);
  const api = useApiWithAuth();

  const renderChildrenContent = useCallback(
    (data: { question_checks: Record<string, boolean>; message: string }) => (
      <div>
        <Button
          disabled={!allQuestionsAnswered}
          className="w-full"
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    ),
    [allQuestionsAnswered, onNext]
  );

  return (
    <DynamicUISuggester<{
      question_checks: Record<string, boolean>;
      message: string;
    }>
      initialMessage="Great! Now, tell us a bit about yourself."
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
  );
}

function ThirdStep({ onNext }: { onNext: () => void }) {
  return <PlanCreatorDynamicUI onNext={onNext} />;
}

function FourthStepCard({
  icon,
  title,
  description,
  buttonText,
  onClick,
  color = "blue",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
  color?: string;
}) {
  return (
    <Card
      className={`p-6 relative overflow-hidden ring-2 ring-${color}-500/20 rounded-2xl`}
    >
      <div className="flex flex-row no-wrap gap-2 items-center">
        <Button
          variant="ghost"
          size="icon"
          className={`text-white rounded-full text-${color}-500 mr-2`}
        >
          {icon}
        </Button>
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <div className="mt-6 space-y-3">{description}</div>
      <Button
        onClick={onClick}
        className={`w-full mt-6 bg-${color}-500 hover:bg-${color}-600 rounded-xl`}
      >
        {buttonText}
      </Button>
    </Card>
  );
}

function FourthStep({ onNext }: { onNext: () => void }) {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const queryClient = useQueryClient();
  const currentUserReceivedFriendRequests =
    currentUserQuery.data?.receivedFriendRequests;

  const pendingFriendRequests = currentUserReceivedFriendRequests?.filter(
    (request) => request.status == "pending"
  ) || [];

  const { data: senderProfiles } = useQuery<SenderProfile[]>({
    queryKey: ['senderProfiles', pendingFriendRequests],
    queryFn: async () => {
      if (!pendingFriendRequests.length) return [];
      const profiles = await Promise.all(
        pendingFriendRequests.map(request =>
          api.get(`/get-user-profile/${request.sender_id}`).then(res => res.data)
        )
      );
      return profiles;
    },
    enabled: pendingFriendRequests.length > 0,
  });

  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await api.post(`/accept-friend-request/${requestId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserData'] });
      queryClient.invalidateQueries({ queryKey: ['senderProfiles'] });
    },
  });

  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await api.post(`/reject-friend-request/${requestId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserData'] });
      queryClient.invalidateQueries({ queryKey: ['senderProfiles'] });
    },
  });

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequestMutation.mutateAsync(requestId);
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

  const { data: userData } = useCurrentUserDataQuery();
  const currentUser = userData?.user;
  const { isSupported: isShareSupported, share } = useShare();
  const api = useApiWithAuth();
  const [copied, copyToClipboard] = useClipboard();
  const [open, setOpen] = useState(false);
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

  return (
    <div className="space-y-6 w-full max-w-md mx-auto">
      <div className="text-center">
        <ScanFace size={100} className="mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-4">
          Great success! As a last step you need to get an accountability
          partner.
        </h2>
        <p className="text-gray-600 mb-6">
          Here&apos;s what we&apos;ll help you go through now
        </p>
      </div>

      <div className="space-y-4">
        <FourthStepCard
          icon={<UserPlus size={30} />}
          title="Invite a friend to the app"
          description="Share your invite link and both join the app free of cost."
          buttonText="Share Invite"
          onClick={handleShareReferralLink}
          color="blue"
        />
        <FourthStepCard
          icon={<Search size={30} />}
          title="Find someone in our community"
          description="Find someone who will help you stay on track"
          buttonText="Open discord"
          onClick={() => {
            window.open("https://discord.gg/zUJNxdw32X", "_blank");
          }}
          color="blue"
        />
        <div>
          <FourthStepCard
            icon={<ScanFace size={30} />}
            title="Use our AI coach"
            description="Get personalized suggestions and support from our AI coach"
            buttonText="Try for free"
            onClick={() => {
              window.open(
                "https://buy.stripe.com/5kA1721cVe3fftK145",
                "_blank"
              );
            }}
            color="indigo"
          />
          <p
            className="text-sm text-gray-500 mx-auto w-full text-center mt-2 underline italic cursor-pointer"
            onClick={() => setOpen(true)}
          >
            Learn more about our plans
          </p>
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
        {!pendingFriendRequests.length && (
          <span className="text-gray-400">
            Your friend requests will appear here, <a onClick={handleShareReferralLink} className="underline cursor-pointer">share them!</a>
          </span>
        )}

        {pendingFriendRequests.length > 0 && senderProfiles && (
          <div className="flex flex-col gap-2 w-full">
            {pendingFriendRequests.map((request, index) => {
              const sender = senderProfiles[index];
              if (!sender) return null;

              return (
                <div key={request.id} className="flex items-center justify-between w-full p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={sender.user?.picture} alt={sender.user?.name} />
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
                      disabled={acceptFriendRequestMutation.isPending || rejectFriendRequestMutation.isPending}
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
                      disabled={acceptFriendRequestMutation.isPending || rejectFriendRequestMutation.isPending}
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
      </div>

      <Button
        disabled={!currentUser?.friend_ids?.length}
        className="w-full mt-6"
        onClick={onNext}
      >
        Finish
      </Button>

      <UpgradePopover open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const renderStep = () => {
    switch (step) {
      case 1:
        return <IntroStep onNext={() => setStep(2)} />;
      case 2:
        return <SecondStep onNext={() => setStep(3)} />;
      case 3:
        return <ThirdStep onNext={() => setStep(4)} />;
      default:
        return <FourthStep onNext={() => {
          hotToast.success("You're all set! You can now start using the app.");
          router.push("/");
        }} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[51] overflow-y-auto">
      <div className="h-full w-full" id="onboarding-page">
        <div className="min-h-full flex flex-col items-center p-4 max-w-4xl mx-auto">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
