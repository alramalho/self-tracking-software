import { AICoachFeaturePreview } from "@/components/AICoachFeaturePreview";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/contexts/theme/useTheme";
import { useCurrentUser } from "@/contexts/users";
import { Check, CheckCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import Lottie from "react-lottie";
import starAnimation from "../../public/animations/star.lottie.json";

interface UpgradePopoverProps {
  open: boolean;
  onClose: () => void;
}

const PLUS_MONTHLY = 9.99;
const PLUS_QUARTERLY = 24.99;
const PLUS_YEARLY = 59.99;

const QUARTERLY_MONTHLY_PRICE = Math.floor((PLUS_QUARTERLY / 3) * 100) / 100;
const YEARLY_MONTHLY_PRICE = Math.floor((PLUS_YEARLY / 12) * 100) / 100;

// Calculate savings compared to monthly
const QUARTERLY_SAVINGS = Math.round(
  ((PLUS_MONTHLY * 3 - PLUS_QUARTERLY) / (PLUS_MONTHLY * 3)) * 100
);
const YEARLY_SAVINGS = Math.round(
  ((PLUS_MONTHLY * 12 - PLUS_YEARLY) / (PLUS_MONTHLY * 12)) * 100
);

interface PricingTier {
  id: "monthly" | "quarterly" | "yearly";
  title: string;
  subtitle: string;
  price: number;
  period: string;
  equivalentMonthly?: number;
  savings?: number;
  badge?: string;
  positioning: string;
  paymentLink: string;
  isPopular?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    id: "monthly",
    title: "Monthly",
    subtitle: "Flexible Plan",
    price: PLUS_MONTHLY,
    period: "month",
    positioning: "Try it out",
    paymentLink: "https://buy.stripe.com/14A3cvdmH5td9E2803cfK0i",
  },
  {
    id: "quarterly",
    title: "Quarterly",
    subtitle: "Most Popular",
    price: PLUS_QUARTERLY,
    period: "3 months",
    equivalentMonthly: QUARTERLY_MONTHLY_PRICE,
    savings: QUARTERLY_SAVINGS,
    badge: "Most Popular",
    positioning: "Commit to real transformation",
    paymentLink: "https://buy.stripe.com/eVqeVdeqLcVF6rQ2FJcfK0h",
    isPopular: true,
  },
  {
    id: "yearly",
    title: "Yearly",
    subtitle: "Best Value",
    price: PLUS_YEARLY,
    period: "year",
    equivalentMonthly: YEARLY_MONTHLY_PRICE,
    savings: YEARLY_SAVINGS,
    badge: `Save ${YEARLY_SAVINGS}%`,
    positioning: "Best long term value",
    paymentLink: "https://buy.stripe.com/8x2aEX1DZ8Fp9E24NRcfK0g",
  },
];

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
  const [selectedTier, setSelectedTier] = useState<
    "monthly" | "quarterly" | "yearly"
  >("quarterly");
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

  const planFeatures = [
    "Unlimited plans & activities",
    "Personalized AI coaching",
    "Enhanced analytics",
    "Customizable color themes and reactions",
  ];

  const currentTier = pricingTiers.find((tier) => tier.id === selectedTier)!;

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
          {/* Pricing Tier Switch */}
          <div className="bg-muted rounded-2xl p-1 grid grid-cols-3 gap-1">
            {pricingTiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`relative py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedTier === tier.id
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span>{tier.title}</span>
                  {tier.savings && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Save {tier.savings}%
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Selected Pricing Card */}
          <Card className="p-6 relative overflow-hidden rounded-2xl">
            <div className="space-y-4">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{currentTier.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {currentTier.positioning}
                  </p>
                </div>
                {currentTier.badge && (
                  <Badge className={`${getThemeClass("primary")} text-white`}>
                    {currentTier.badge}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    €{currentTier.equivalentMonthly || currentTier.price}
                  </span>
                  <span className="text-muted-foreground">/ month</span>
                </div>
                {currentTier.equivalentMonthly && (
                  <p className="text-sm text-muted-foreground">
                    €{currentTier.price} per {currentTier.period}
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
                  href={`${currentTier.paymentLink}?client_reference_id=${currentUser?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button className={`w-full rounded-xl ${getThemeClass("primary")} ${getThemeClass("hover")} text-white text-lg py-6`}>
                    Start Free Trial
                  </Button>
                </a>
              )}
            </div>
          </Card>

          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p>All plans include a free trial and full access to all features.</p>
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
