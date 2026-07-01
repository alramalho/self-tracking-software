"use client";

import AppleLikePopover from "@/components/AppleLikePopover";
import { RecommendedUsers } from "@/components/RecommendedUsers";
import { SATISFACTORY_PARTNER_MATCH_MIN_SCORE } from "@/components/recommendations/partnerRecommendationFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { Loader2, Search, Send, Users } from "lucide-react";
import { useState } from "react";

const OptionCard = ({
  onClick,
  icon,
  title,
  description,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) => {
  return (
    <button
      onClick={onClick}
      className="w-full p-5 rounded-xl border-2 border-border bg-card hover:bg-muted/50 transition-all duration-200 text-left"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-muted">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-md font-semibold text-foreground">{title}</h3>
          <p className="text-xs mt-1 text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
};

const CommunityPartnerFinder = () => {
  const { completeStep, planId, selectedPlan } = useOnboarding();
  const { shareOrCopyReferralLink } = useShareOrCopy();
  const { isLoadingPlans } = usePlans();
  const [communitySearchOpen, setCommunitySearchOpen] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const { isLoadingCurrentUser } = useCurrentUser();
  const partnerPlanId = selectedPlan?.id || planId;

  const completeOnboarding = () => {
    setIsContinuing(true);
    completeStep(
      "community-partner-finder",
      { partnerType: null },
      { complete: true }
    );
  };

  return (
    <>
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <Users className="w-20 h-20 text-blue-600" />
            <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
              Want an accountability partner?
            </h2>
          </div>
          <p className="text-md text-muted-foreground">
            Research shows having a partner increases your odds of success up to{" "}
            <span className="font-semibold text-foreground">95%</span>.
          </p>
        </div>

        <div className="space-y-3">
          <OptionCard
            onClick={() => {
              setCommunitySearchOpen(true);
            }}
            icon={<Search className="w-6 h-6" />}
            title="Find one in our community"
            description="Browse people with similar goals and connect for mutual accountability"
          />
          <OptionCard
            onClick={async () => {
              await shareOrCopyReferralLink();
            }}
            icon={<Send className="w-6 h-6" />}
            title="Invite someone you know"
            description="Send your personal link to a friend, family member, or colleague"
          />
        </div>

        {/* Skip link */}
        <div className="text-center">
          <button
            onClick={() => completeOnboarding()}
            className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-70"
            disabled={isContinuing}
          >
            {isContinuing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isContinuing ? "Skipping..." : "Skip for now"}
          </button>
        </div>
      </div>

      <AppleLikePopover
        open={communitySearchOpen}
        onClose={() => {
          setCommunitySearchOpen(false);
        }}
      >
        {isLoadingCurrentUser || isLoadingPlans ? (
          <div className="space-y-6 mt-4">
            <div>
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="grid grid-cols-1 justify-items-center">
                <Skeleton className="h-48 w-full max-w-sm rounded-lg" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-48 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <RecommendedUsers
              selectedPlanId={partnerPlanId}
              minScore={SATISFACTORY_PARTNER_MATCH_MIN_SCORE}
            />
          </div>
        )}
      </AppleLikePopover>
    </>
  );
};

export default withFadeUpAnimation(CommunityPartnerFinder);
