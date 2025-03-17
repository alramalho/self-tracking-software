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

const PLUS_MONTHLY = 7.99;
const PLUS_YEARLY = 71.99;
const PLUS_DISCOUNTED_MONTHLY = 4.99;
const PLUS_DISCOUNTED_YEARLY = 44.99;

const YEARLY_DISCOUNT_PERCENT = Math.round(
  (Math.abs(PLUS_DISCOUNTED_YEARLY - 12 * PLUS_DISCOUNTED_MONTHLY) /
    (12 * PLUS_DISCOUNTED_MONTHLY)) *
    100
);

const FIXED_DISCOUNT_PERCENT = Math.round(
  (Math.abs(PLUS_MONTHLY - PLUS_DISCOUNTED_MONTHLY) / PLUS_MONTHLY) * 100
);

// const PLUS_DISCOUNTED_MONTHLY = Number(
//   (PLUS_DISCOUNTED_MONTHLY * (1 - PLUS_DISCOUNT_PERCENT / 100)).toFixed(2)
// );
// const PLUS_DISCOUNTED_YEARLY = Number(
//   (PLUS_DISCOUNTED_YEARLY * (1 - PLUS_DISCOUNT_PERCENT / 100)).toFixed(2)
// );

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
  const launchDate = "2025-04-11T00:00:00";

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
        we&apos;re just launching... <br /> so here&apos;s a{" "}
        <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent animate-gradient rounded-xl">
          {FIXED_DISCOUNT_PERCENT}%
        </span>{" "}
        discount for your early support
      </h2>
      <CountdownTimer targetDate={launchDate} />
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
  const [isYearly, setIsYearly] = useState(false);

  const planFeatures: FeatureItem[] = [
    { emoji: "✔️", title: <span>Personalized AI coaching</span> },
    { emoji: "✔️", title: <span>Metrics and insights</span> },
    { emoji: "✔️", title: <span>Unlimited plans</span> },
    { emoji: "✔️", title: <span>Full app customization</span> },
  ];

  // const peoplePlanFeatures: FeatureItem[] = [
  //   { emoji: "✔️", title: <span>everything in plus plan</span> },
  //   {
  //     emoji: "✔️",
  //     title: (
  //       <span>
  //         AI personal coach{" "}
  //         <Badge className="bg-purple-500 text-white">BETA</Badge>
  //       </span>
  //     ),
  //   },
  //   { emoji: "✔️", title: <span>access to BETA features and voting</span> },
  //   {
  //     emoji: "✔️",
  //     title: <span>custom and unlimited metrics / insights</span>,
  //   },
  //   { emoji: "🔥", title: <span>exclusive open source supporter badge</span> },
  // ];

  const getPeriod = () => (isYearly ? "yearly" : "monthly");

  const paymentLink = isYearly
    ? "https://buy.stripe.com/00g1722gZ8IV5Ta7sA"
    : "https://buy.stripe.com/cN24jef3LgbnchyaEK";

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="space-y-8 pt-6 pb-12">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">
            <span className="italic">support open source</span>
          </h1>
          <h2 className="text-2xl font-bold">and unlock this</h2>
          {/* <p className="text-gray-500 font-cursive text-2xl font-extralight">Become an open source supporter 🔥</p> */}
        </div>

        <div className="grid gap-4">
          <Rocket />

          <Card className="p-6 relative overflow-hidden ring-2 ring-blue-500/50 rounded-2xl bg-gradient-to-br from-white to-blue-100">
            <div className="space-y-2">
              <div className="flex flex-row items-center justify-between gap-2">
                <h3 className="text-xl font-semibold">
                  <span className="text-blue-500 text-3xl font-cursive mr-1">
                    Plus
                  </span>{" "}
                  Plan
                </h3>
                <div>
                  {/* {isYearly && (
                    <Badge className="ml-2 bg-green-500 text-white">
                      Save {YEARLY_DISCOUNT_PERCENT}%
                    </Badge>
                  )} */}
                  <Badge className="ml-2 bg-purple-500 text-white">
                    Save {FIXED_DISCOUNT_PERCENT}%
                  </Badge>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-medium text-gray-500 line-through">
                  {isYearly ? `€${PLUS_YEARLY}` : `€${PLUS_MONTHLY}`}
                </span>
                <span className="text-3xl font-bold">
                  {isYearly
                    ? `€${PLUS_DISCOUNTED_YEARLY}`
                    : `€${PLUS_DISCOUNTED_MONTHLY}`}
                </span>
                <span className="text-gray-500">/ {getPeriod()}</span>
              </div>
              {isYearly && (
                <p className="text-sm text-gray-500">
                  {isYearly
                    ? <span>€{(PLUS_DISCOUNTED_YEARLY / 12).toFixed(2)} a month <span className="text-green-500">{YEARLY_DISCOUNT_PERCENT}% off!</span></span>
                    : `€${PLUS_DISCOUNTED_MONTHLY} a month `}
                </p>
              )}
            </div>
            <div className="mt-6 space-y-3">
              {planFeatures.map((feature, index) => (
                <div
                  key={`slack-feature-${index}`}
                  className="flex items-center gap-2"
                >
                  <span>{feature.emoji}</span>
                  <span>{feature.title}</span>
                </div>
              ))}
            </div>
            <Coffee />

            <Link href={paymentLink} target="_blank">
              <Button className="w-full mt-6 bg-blue-500 hover:bg-blue-600 rounded-xl">
                Try free
              </Button>
            </Link>
          </Card>

          <div className="flex items-center justify-center gap-2">
            <span className="text-md text-gray-500">Monthly</span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <span className="text-md text-gray-500">Yearly</span>
            <span className="text-sm text-green-500 ml-1">
              get {Math.round(12 * (1 - PLUS_YEARLY / (12 * PLUS_MONTHLY)))}{" "}
              months free
            </span>
          </div>
        </div>

        <Divider className="my-6 mt-24" />
        <FAQ />
      </div>
    </AppleLikePopover>
  );
};
