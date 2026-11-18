import { AICoachFeaturePreview } from "@/components/AICoachFeaturePreview";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/contexts/theme/useTheme";
import { useCurrentUser } from "@/contexts/users";
import { Capacitor } from "@capacitor/core";
import { coachingPlans } from "@/components/onboarding/api";
import { LABELS, money, paywallCta, period, savingVsWeekly, weeksIn } from "@/components/onboarding/paywall/plans";
import { useQuery } from "@tanstack/react-query";
import { Check, CheckCircle } from "lucide-react";
import React, { useEffect, useState } from "react";

interface UpgradePopoverProps {
  open: boolean;
  onClose: () => void;
}

export const Coffee = () => {
  return (
    <div className="flex flex-row gap-2 items-center justify-center">
      <span className="text-2xl font-bold text-foreground font-cursive">
        is your consistency worth a
      </span>
      <div className="relative">
        <div className="animate-float rotate-3 hover:rotate-6 transition-transform">
          <picture>
            <source
              srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/2615/512.webp"
              type="image/webp"
            />
            <img
              src="https://fonts.gstatic.com/s/e/notoemoji/latest/2615/512.gif"
              alt="☕"
              width="64"
              height="64"
            />
          </picture>
          {/* <p className="text-2xl text-muted-foreground font-bold font-cursive absolute bottom-[-10px] left-[calc(50%-5px)] translate-x-[-50%]">
        latte
      </p> */}
        </div>
      </div>
      <span className="text-2xl font-bold text-foreground font-cursive">?</span>
    </div>
  );
};

export const UpgradePopover: React.FC<UpgradePopoverProps> = ({
  open,
  onClose,
}) => {
  // The same plans, prices and checkout links as the onboarding paywall, read live from Stripe.
  const offer = useQuery({ queryKey: ["coaching-offer"], queryFn: coachingPlans, enabled: open, retry: 1 });
  const plans = offer.data ?? [];
  const [selectedId, setSelectedId] = useState<string>();
  const {currentUser, refetchCurrentUser} = useCurrentUser();
  const { getThemeClass } = useTheme();

  useEffect(() => {
    if (!open) return;
    
    const interval = setInterval(() => {
      refetchCurrentUser(false);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [refetchCurrentUser, open]);
  
  const isUserPremium = currentUser?.planType === 'PLUS';
  const isNativeIOS =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

  const planFeatures = [
    "Unlimited plans & activities",
    "Personalized AI coaching",
    "Enhanced analytics",
    "Customizable color themes and reactions",
  ];

  const currentPlan = plans.find((plan) => plan.id === selectedId) ?? plans[0];
  const currentSaving = currentPlan ? savingVsWeekly(currentPlan, plans) : 0;

  if (isNativeIOS) {
    return (
      <AppleLikePopover open={open} onClose={onClose}>
        <div className="space-y-8 pt-6 pb-12">
          <AICoachFeaturePreview
            aiCoachPersonality={currentUser?.coachPersonality}
            inlineDemos
          />
          <Card className="p-6 rounded-2xl">
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold">tracking.so Plus</h3>
                <p className="text-sm text-muted-foreground">
                  Extra tools for consistency and coaching
                </p>
              </div>
              <div className="grid grid-cols-1 gap-0">
                {planFeatures.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 py-1.5 text-sm"
                  >
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-muted-foreground flex-1">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
              {isUserPremium ? (
                <Button
                  className="w-full rounded-xl bg-green-500 hover:bg-emerald-700 text-lg py-6"
                  onClick={onClose}
                >
                  <CheckCircle className="mr-2 w-4 h-4" />
                  Continue
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button className="w-full rounded-xl text-lg py-6" disabled>
                    Plus requires an existing subscription
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Existing subscribers can sign in with the same account to
                    use Plus features.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </AppleLikePopover>
    );
  }

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="space-y-8 pt-6 pb-12">

        <div className="space-y-5">
          <AICoachFeaturePreview
            aiCoachPersonality={currentUser?.coachPersonality}
            inlineDemos
          />
        </div>

        <div className="grid gap-6">
          {offer.isError && (
            <p className="text-center text-sm text-muted-foreground">
              Plans couldn&apos;t load. Close this and try again.
            </p>
          )}
          {plans.length > 1 && (
            <div className={`bg-muted rounded-2xl p-1 grid gap-1`} style={{ gridTemplateColumns: `repeat(${plans.length}, minmax(0, 1fr))` }}>
              {plans.map((plan) => {
                const saving = savingVsWeekly(plan, plans);
                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedId(plan.id)}
                    className={`relative py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                      plan.id === currentPlan?.id
                        ? "bg-card shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>{LABELS[plan.id]}</span>
                      {saving > 0 && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                          Save {saving}%
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected Pricing Card */}
          {currentPlan && (
          <Card className="p-6 relative overflow-hidden rounded-2xl">
            <div className="space-y-4">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{LABELS[currentPlan.id]}</h3>
                  <p className="text-sm text-muted-foreground">
                    {currentPlan.trialDays ? `${currentPlan.trialDays} days free, then` : "Cancel anytime"}
                  </p>
                </div>
                {currentSaving > 0 && (
                  <Badge className={`${getThemeClass("primary")} text-white`}>
                    Save {currentSaving}% vs weekly
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    {money(currentPlan, currentPlan.amount / weeksIn(currentPlan))}
                  </span>
                  <span className="text-muted-foreground">/ week</span>
                </div>
                {currentPlan.id !== "weekly" && (
                  <p className="text-sm text-muted-foreground">
                    {money(currentPlan)} every {period(currentPlan)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  What&apos;s included
                </div>
                <div className="grid grid-cols-1 gap-0">
                  {planFeatures.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 py-1.5 text-sm"
                    >
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-muted-foreground flex-1">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {isUserPremium ? (
                <Button
                  className="w-full rounded-xl bg-green-500 hover:bg-emerald-700 text-lg py-6"
                  onClick={() => {
                    onClose();
                  }}
                >
                  <CheckCircle className="mr-2 w-4 h-4" />
                  Continue
                </Button>
              ) : (
                <a
                  href={currentPlan.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button className={`w-full rounded-xl ${getThemeClass("primary")} ${getThemeClass("hover")} text-white text-lg py-6`}>
                    {paywallCta(currentPlan)}
                  </Button>
                </a>
              )}
            </div>
          </Card>
          )}

          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p>Every plan starts with a free week and has every feature.</p>
            <p>Cancel anytime.</p>
            <a
              href="https://tracking.so/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </AppleLikePopover>
  );
};
