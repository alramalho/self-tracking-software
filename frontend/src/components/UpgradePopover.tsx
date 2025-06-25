import React, { useState, ReactNode, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { FAQ } from "./FAQ";
import Divider from "./Divider";
import Link from "next/link";

interface FeatureItem {
  emoji: string;
  title: ReactNode;
}

interface UpgradePopoverProps {
  open: boolean;
  onClose: () => void;
}

const PLUS_MONTHLY = 13.99;
const PLUS_QUARTERLY = 29.99;
const PLUS_YEARLY = 83.99;

// Calculate savings
const QUARTERLY_MONTHLY_EQUIVALENT = PLUS_MONTHLY * 3;
const YEARLY_MONTHLY_EQUIVALENT = PLUS_MONTHLY * 12; 

const QUARTERLY_SAVINGS = Math.round(((QUARTERLY_MONTHLY_EQUIVALENT - PLUS_QUARTERLY) / QUARTERLY_MONTHLY_EQUIVALENT) * 100);
const YEARLY_SAVINGS = Math.round(((YEARLY_MONTHLY_EQUIVALENT - PLUS_YEARLY) / YEARLY_MONTHLY_EQUIVALENT) * 100);

// Calculate equivalent monthly prices
const QUARTERLY_MONTHLY_PRICE = Math.floor((PLUS_QUARTERLY / 3) * 100) / 100;
const YEARLY_MONTHLY_PRICE = Math.floor((PLUS_YEARLY / 12) * 100) / 100;

interface PricingTier {
  id: 'monthly' | 'quarterly' | 'yearly';
  title: string;
  subtitle: string;
  price: number;
  period: string;
  equivalentMonthly?: number;
  savings?: number;
  badge?: string;
  badgeColor?: string;
  positioning: string;
  paymentLink: string;
  isPopular?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    id: 'monthly',
    title: 'Monthly',
    subtitle: 'Flexible Plan',
    price: PLUS_MONTHLY,
    period: 'month',
    positioning: 'Try it risk-free',
    paymentLink: 'https://buy.stripe.com/14A00j6Yjg7R17wfsvcfK0d',
  },
  {
    id: 'quarterly',
    title: 'Quarterly',
    subtitle: 'Most Popular',
    price: PLUS_QUARTERLY,
    period: '3 months',
    equivalentMonthly: QUARTERLY_MONTHLY_PRICE,
    savings: QUARTERLY_SAVINGS,
    badge: 'Most Popular',
    badgeColor: 'bg-purple-500',
    positioning: 'Build lasting habits',
    paymentLink: 'https://buy.stripe.com/9B64gzdmH7Bl17wa8bcfK0b',
    isPopular: true,
  },
  {
    id: 'yearly',
    title: 'Yearly',
    subtitle: 'Best Value',
    price: PLUS_YEARLY,
    period: 'year',
    equivalentMonthly: YEARLY_MONTHLY_PRICE,
    savings: YEARLY_SAVINGS,
    badge: `Save ${YEARLY_SAVINGS}%`,
    badgeColor: 'bg-green-500',
    positioning: 'Commit to real transformation',
    paymentLink: 'https://buy.stripe.com/fZu6oHbez6xh9E2fsvcfK0c',
  },
];

export const Coffee = () => {
  return (
    <div className="flex flex-row gap-2 items-center justify-center">
      <span className="text-2xl font-bold text-gray-700 font-cursive">
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
          {/* <p className="text-2xl text-gray-500 font-bold font-cursive absolute bottom-[-10px] left-[calc(50%-5px)] translate-x-[-50%]">
        latte
      </p> */}
        </div>
      </div>
      <span className="text-2xl font-bold text-gray-700 font-cursive">?</span>
    </div>
  );
};

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface CountdownTimerProps {
  targetDate: string;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const target = new Date(targetDate);

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = Math.abs(target.getTime() - now.getTime());
      console.log({ difference });

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="grid grid-cols-4 gap-1 w-full">
      <div className="flex flex-col">
        <div className="text-2xl font-bold bg-gray-100 rounded-lg p-2">
          {timeLeft.days}
        </div>
        <div className="text-xs text-gray-500">days</div>
      </div>
      <div className="flex flex-col">
        <div className="text-2xl font-bold bg-gray-100 rounded-lg p-2">
          {timeLeft.hours}
        </div>
        <div className="text-xs text-gray-500">hours</div>
      </div>
      <div className="flex flex-col">
        <div className="text-2xl font-bold bg-gray-100 rounded-lg p-2">
          {timeLeft.minutes}
        </div>
        <div className="text-xs text-gray-500">minutes</div>
      </div>
      <div className="flex flex-col">
        <div className="text-2xl font-bold bg-gray-100 rounded-lg p-2">
          {timeLeft.seconds}
        </div>
        <div className="text-xs text-gray-500">seconds</div>
      </div>
    </div>
  );
};

const Rocket = () => {
  const launchDate = "2025-06-30T00:00:00";

  if (launchDate < new Date().toISOString()) {
    return null;
  }

  return (
    <div className="text-center bg-white/70 space-y-2 border-2 border-gray-200 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center">
      <div className="flex items-center justify-center">
        <picture>
          <source
            srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.webp"
            type="image/webp"
          />
          <img
            src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.gif"
            alt="🚀"
            width="72"
            height="72"
          />
        </picture>
      </div>
      <h2 className="text-xl font-bold">
        We&apos;re running a launch campaign until
      </h2>
      <CountdownTimer targetDate={launchDate} />
      <h2 className="text-xl font-bold text-gray-700 pt-5">
        Here&apos;s a <br />
        <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent animate-gradient rounded-xl">
          {YEARLY_SAVINGS}%
        </span>{" "}
        discount for early supporters
      </h2>
      <span className="text-sm text-gray-500 mt-1">
        and maybe some day we can go full time :)
      </span>
    </div>
  );
};

export const UpgradePopover: React.FC<UpgradePopoverProps> = ({
  open,
  onClose,
}) => {
  const planFeatures: FeatureItem[] = [
    { emoji: "✔️", title: <span>Unlimited plans & activities</span> },
    // { emoji: "🔒", title: <span>Activity privacy</span> },
    { emoji: "🦾", title: <span>Personalized AI coaching</span> },
    { emoji: "📊", title: <span>Enhanced Analytics</span> },
    {
      emoji: "🎨",
      title: <span>Customizable color themes and reactions</span>,
    },
  ];

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="space-y-8 pt-6 pb-12">
        <div className="grid gap-6">
          {/* <Rocket /> */}

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Choose Your Plan</h2>
            <p className="text-gray-600">Select the plan that fits your journey</p>
          </div>

          <div className="grid gap-4">
            {pricingTiers.map((tier) => (
              <Card 
                key={tier.id}
                className={`p-6 relative overflow-hidden rounded-2xl transition-all duration-200 hover:shadow-lg ${
                  tier.isPopular 
                    ? 'ring-2 ring-purple-500/50 bg-gradient-to-br from-white to-purple-50' 
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex flex-row items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{tier.title}</h3>
                      <p className="text-sm text-gray-600">{tier.positioning}</p>
                    </div>
                    {tier.badge && (
                      <Badge className={`${tier.badgeColor} text-white`}>
                        {tier.badge}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">€{tier.price}</span>
                      <span className="text-gray-500">/ {tier.period}</span>
                    </div>
                    {tier.equivalentMonthly && (
                      <p className="text-sm text-gray-600">
                        €{tier.equivalentMonthly} per month
                        {tier.savings && (
                          <span className="text-green-600 font-medium ml-1">
                            • Save {tier.savings}%
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {tier.isPopular && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">What&apos;s included:</div>
                      <div className="grid grid-cols-1 gap-1">
                        {planFeatures.slice(0, 3).map((feature, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <span className="text-xs">{feature.emoji}</span>
                            <span className="text-gray-600">{feature.title}</span>
                          </div>
                        ))}
                        <div className="text-xs text-gray-500 mt-1">+ 2 more features</div>
                      </div>
                    </div>
                  )}

                  <Link href={tier.paymentLink} target="_blank" className="block">
                    <Button 
                      className={`w-full rounded-xl ${
                        tier.isPopular 
                          ? 'bg-purple-500 hover:bg-purple-600' 
                          : 'bg-blue-500 hover:bg-blue-600'
                      }`}
                    >
                      {tier.id === 'monthly' ? 'Start Free Trial' : 
                       tier.id === 'quarterly' ? 'Get Started' : 'Best Value'}
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-500 space-y-1">
              <p>All plans include:</p>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                   <div className="flex items-center gap-1">
                    <span className="text-xs">·</span>
                    <span className="text-xs">Free trial</span>
                  </div>
                {planFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <span className="text-xs">{feature.emoji}</span>
                    <span className="text-xs">{feature.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>


                
        <h4 className="text-center text-8xl font-bold">🎯</h4>
        <h4 className="text-center text-xl font-bold">thank you for your support! perhaps one day we can go full time :)</h4>

        <Divider className="my-6 mt-24" />
        {/* <FAQ /> */}
      </div>
    </AppleLikePopover>
  );
};
