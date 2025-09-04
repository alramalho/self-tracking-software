import AppleLikePopover from "@/components/AppleLikePopover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrentUser } from "@/contexts/users";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import React, { ReactNode, useEffect, useState } from "react";
import Lottie from "react-lottie";
import rocketAnimation from "../../public/animations/rocket.lottie.json";
import Divider from "./Divider";
import { Avatar, AvatarImage } from "./ui/avatar";

interface FeatureItem {
  emoji: string;
  title: ReactNode;
}

interface UpgradePopoverProps {
  open: boolean;
  onClose: () => void;
}

const OG_MONTHLY = 13.99;
const OG_QUARTERLY = 29.99;
const OG_YEARLY = 83.99;

const PLUS_MONTHLY = 8.99;
const PLUS_QUARTERLY = 20.99;
const PLUS_YEARLY = 59.99;

// Calculate savings
const QUARTERLY_MONTHLY_EQUIVALENT = OG_MONTHLY * 3;
const YEARLY_MONTHLY_EQUIVALENT = OG_MONTHLY * 12;

const MONTHLY_SAVINGS = Math.round(
  ((OG_MONTHLY - PLUS_MONTHLY) / OG_MONTHLY) * 100
);

const QUARTERLY_SAVINGS = Math.round(
  ((QUARTERLY_MONTHLY_EQUIVALENT - PLUS_QUARTERLY) /
    QUARTERLY_MONTHLY_EQUIVALENT) *
    100
);
const YEARLY_SAVINGS = Math.round(
  ((YEARLY_MONTHLY_EQUIVALENT - PLUS_YEARLY) / YEARLY_MONTHLY_EQUIVALENT) * 100
);
const YEARLY_OG_SAVINGS = Math.round(
  ((OG_YEARLY - PLUS_YEARLY) / OG_YEARLY) * 100
);

// Calculate equivalent monthly prices
const QUARTERLY_MONTHLY_PRICE = Math.floor((PLUS_QUARTERLY / 3) * 100) / 100;
const YEARLY_MONTHLY_PRICE = Math.floor((PLUS_YEARLY / 12) * 100) / 100;

interface PricingTier {
  id: "monthly" | "quarterly" | "yearly";
  title: string;
  subtitle: string;
  ogPrice: number;
  ogMonthlyEquivalent: number;
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
    id: "monthly",
    title: "Monthly",
    subtitle: "Flexible Plan",
    ogPrice: OG_MONTHLY,
    ogMonthlyEquivalent: OG_MONTHLY,
    price: PLUS_MONTHLY,
    savings: MONTHLY_SAVINGS,
    period: "month",
    positioning: "Try it out",
    paymentLink: "https://buy.stripe.com/fZu28reqL7BlaI6eorcfK0e",
  },
  {
    id: "quarterly",
    title: "Quarterly",
    subtitle: "Most Popular",
    ogPrice: OG_MONTHLY,
    ogMonthlyEquivalent: Math.floor((OG_QUARTERLY / 3) * 100) / 100,
    price: PLUS_QUARTERLY,
    period: "3 months",
    equivalentMonthly: QUARTERLY_MONTHLY_PRICE,
    savings: QUARTERLY_SAVINGS,
    badge: "Most Popular",
    badgeColor: "bg-purple-500",
    positioning: "Commit to real transformation",
    paymentLink: "https://buy.stripe.com/eVqeVd2I32h16rQgwzcfK0f",
    isPopular: true,
  },
  {
    id: "yearly",
    title: "Yearly",
    subtitle: "Best Value",
    ogPrice: OG_MONTHLY,
    ogMonthlyEquivalent: Math.floor((OG_YEARLY / 12) * 100) / 100,
    price: PLUS_YEARLY,
    period: "year",
    equivalentMonthly: YEARLY_MONTHLY_PRICE,
    savings: YEARLY_SAVINGS,
    badge: `Save ${YEARLY_SAVINGS}%`,
    badgeColor: "bg-green-500",
    positioning: "Best long term value",
    paymentLink: "https://buy.stripe.com/8x2aEX1DZ8Fp9E24NRcfK0g",
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
    <div className="flex justify-center gap-1 w-full">
      <div className="flex flex-col items-center">
        <div className="text-xl font-bold bg-gray-100 rounded py-2 px-5 min-w-[4rem] text-center">
          {timeLeft.days}
        </div>
        <div className="text-xs text-gray-500">days</div>
      </div>
      <div className="flex flex-col items-center">
        <div className="text-xl font-bold bg-gray-100 rounded py-2 px-5 min-w-[4rem] text-center">
          {timeLeft.hours}
        </div>
        <div className="text-xs text-gray-500">hours</div>
      </div>
      <div className="flex flex-col items-center">
        <div className="text-xl font-bold bg-gray-100 rounded py-2 px-5 min-w-[4rem] text-center">
          {timeLeft.minutes}
        </div>
        <div className="text-xs text-gray-500">minutes</div>
      </div>
      <div className="flex flex-col items-center">
        <div className="text-xl font-bold bg-gray-100 rounded py-2 px-5 min-w-[4rem] text-center">
          {timeLeft.seconds}
        </div>
        <div className="text-xs text-gray-500">seconds</div>
      </div>
    </div>
  );
};

const RocketSection = () => {
  const getNextLaunchDate = () => {
    const originalDate = new Date("2025-07-05T00:00:00");
    const now = new Date();

    if (now <= originalDate) {
      return originalDate.toISOString();
    }

    const daysPassed = Math.floor(
      (now.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const cycles = Math.floor(daysPassed / 12);
    const nextCycle = cycles + 1;

    const nextLaunchDate = new Date(originalDate);
    nextLaunchDate.setDate(originalDate.getDate() + nextCycle * 12);

    return nextLaunchDate.toISOString();
  };

  const launchDate = getNextLaunchDate();

  return (
    <div className="text-center bg-white/70 space-y-2 border-2 border-gray-200 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center">
      <div className="flex items-center justify-center gap-2">
        <Lottie
          options={{
            loop: true,
            autoplay: true,
            animationData: rocketAnimation,
            rendererSettings: {
              preserveAspectRatio: "xMidYMid slice",
            },
          }}
          height={60}
          width={60}
        />
        <h2 className="text-xl font-bold">Launching discount!</h2>
      </div>
      <div className="text-center space-y-2 pb-4">
        <h2 className="text-md font-normal text-gray-700 pt-2">
          We&apos;re offering a{" "}
          <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent animate-gradient rounded-xl">
            big discount{" "}
          </span>
          for early supporters until our launch date!
        </h2>
      </div>
      <CountdownTimer targetDate={launchDate} />
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

  useEffect(() => {
    const interval = setInterval(() => {
      refetchCurrentUser(false);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [refetchCurrentUser]);
  
  const isUserPremium = currentUser?.planType === 'PLUS';

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

  const currentTier = pricingTiers.find((tier) => tier.id === selectedTier)!;

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="space-y-8 pt-6 pb-12">
        <div className="grid gap-6">
          <RocketSection />

          {/* Pricing Tier Switch */}
          <div className="bg-gray-100 rounded-2xl p-1 grid grid-cols-3 gap-1">
            {pricingTiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`relative py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedTier === tier.id
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span>{tier.title}</span>
                  {tier.savings && (
                    <span className="text-xs text-green-600 font-medium">
                      Save {tier.savings}%
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Selected Pricing Card */}
          <Card className="p-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-purple-50 ring-2 ring-purple-500/50">
            <div className="space-y-4">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{currentTier.title}</h3>
                  <p className="text-sm text-gray-500">
                    {currentTier.positioning}
                  </p>
                </div>
                {currentTier.badge && (
                  <Badge className={`${currentTier.badgeColor} text-white`}>
                    {currentTier.badge}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-normal line-through text-gray-500">
                    €{currentTier.ogPrice}
                  </span>
                  <span className="text-gray-500">/ month</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    €{currentTier.equivalentMonthly || currentTier.price}
                  </span>
                  <span className="text-gray-500">/ month</span>
                </div>
                {currentTier.equivalentMonthly && (
                  <p className="text-sm text-gray-600">
                    €{currentTier.price} per {currentTier.period}
                    {currentTier.savings && (
                      <span className="text-green-600 font-medium ml-1">
                        • Save {currentTier.savings}%
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">
                  What&apos;s included:
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {planFeatures.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="text-sm">{feature.emoji}</span>
                      <span className="text-gray-600">{feature.title}</span>
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
                <Link
                  href={currentTier.paymentLink}
                  target="_blank"
                  className="block"
                >
                  <Button className="w-full rounded-xl bg-purple-500 hover:bg-purple-600 text-lg py-6">
                    Start Free Trial
                  </Button>
                </Link>
              )}
            </div>
          </Card>

          <div className="text-center">
            <div className="text-sm text-gray-500 space-y-1">
              <p>
                All plans include a free trial and full access to all features
              </p>
              <p>Cancel anytime, no strings attached.</p>
            </div>
          </div>
        </div>

        <Divider className="my-6 mt-24" />
        {/* <FAQ /> */}
        <div className="flex flex-row gap-4 items-start justify-center bg-gray-200/80 p-7 rounded-2xl">
          <div className="flex flex-col">
            <div className="flex flex-row gap-4 items-center">
              <Avatar className="w-10 h-10 ring-2 ring-blue-500 ring-offset-2 ring-offset-white">
                <AvatarImage
                  src={
                    "https://images.clerk.dev/oauth_google/img_2nWIRuxpfaqd2hVzjtFkClrFSn7"
                  }
                  alt={"Alex"}
                />
              </Avatar>
              <span className="text-xl font-bold font-cursive">
                Hello 👋
                <br />
                I&apos;m Alex, the founder.
              </span>
            </div>
            <div className="text-sm text-gray-500 space-y-4 mt-4">
              <p>
                Tracking Software is my attempt at creating a better social
                network, where comparison can be used as leverage to improve
                your life, not just to make you feel worse.
              </p>
              <p>
                I truly believe social networks should be fully transparent, and
                that&apos;s why , despite not being the best commercial
                decision, <span className="underline">tracking.so </span>
                is{" "}
                <b>
                  the only habit based social network that is fully open source
                </b>
                .
              </p>
              <p>
                Together we can make a better internet, where social apps make
                you feel better, not worse.
              </p>
              <p>Thank you for considering upgrading.</p>

              <p>Alex</p>
            </div>
          </div>
        </div>
      </div>
    </AppleLikePopover>
  );
};
