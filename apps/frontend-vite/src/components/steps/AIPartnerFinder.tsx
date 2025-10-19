/* eslint-disable react-refresh/only-export-components */
"use client";
import { AICoachFeaturePreview } from "@/components/AICoachFeaturePreview";
import { Button } from "@/components/ui/button";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { CheckCircle, MoveRight } from "lucide-react";

const AIPartnerFinder = () => {
  const { completeStep } = useOnboarding();
  const { setShowUpgradePopover } = useUpgrade();
  const { isUserPremium } = usePaidPlan();

  return (
    <AICoachFeaturePreview>
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

      {!isUserPremium && (
        <Button
          size="lg"
          variant="ghost"
          className="w-full rounded-xl text-muted-foreground"
          onClick={() => {
            completeStep("ai-partner-finder", {}, { complete: true });
          }}
        >
          Continue without coaching
        </Button>
      )}
    </AICoachFeaturePreview>
  );
};

export default withFadeUpAnimation(AIPartnerFinder);
