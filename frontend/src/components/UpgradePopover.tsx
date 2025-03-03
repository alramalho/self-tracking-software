import React, { useState, ReactNode } from "react";
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

const PLUS_MONTHLY = 5.99;
const PLUS_YEARLY = 34.99;
const SUPPORTER_MONTHLY = 12.98;
const SUPPORTER_YEARLY = 74.99;

const PLUS_DISCOUNT_PERCENT = Math.round(
  ((PLUS_MONTHLY * 12 - PLUS_YEARLY) / (PLUS_MONTHLY * 12)) * 100
);
const SUPPORTER_DISCOUNT_PERCENT = Math.round(
  ((SUPPORTER_MONTHLY * 12 - SUPPORTER_YEARLY) / (SUPPORTER_MONTHLY * 12)) * 100
);
const MAX_DISCOUNT = Math.max(
  PLUS_DISCOUNT_PERCENT,
  SUPPORTER_DISCOUNT_PERCENT
);

export const UpgradePopover: React.FC<UpgradePopoverProps> = ({
  open,
  onClose,
}) => {
  const [isYearly, setIsYearly] = useState(false);

  const slackPlanFeatures: FeatureItem[] = [
    { emoji: "✔️", title: <span>5 metrics and insights</span> },
    { emoji: "✔️", title: <span>habit and lifestyle streak badges</span> },
    { emoji: "✔️", title: <span>theme customization</span> },
  ];

  const peoplePlanFeatures: FeatureItem[] = [
    { emoji: "✔️", title: <span>everything in plus plan</span> },
    {
      emoji: "✔️",
      title: (
        <span>
          AI personal coach{" "}
          <Badge className="bg-purple-500 text-white">BETA</Badge>
        </span>
      ),
    },
    { emoji: "✔️", title: <span>access to BETA features and voting</span> },
    { emoji: "✔️", title: <span>custom and unlimited metrics / insights</span> },
    { emoji: "🔥", title: <span>exclusive open source supporter badge</span> },
  ];

  const formatPrice = (monthlyPrice: number, yearlyPrice: number) => {
    return isYearly ? `$${yearlyPrice}` : `$${monthlyPrice}`;
  };

  const getMonthlyDisplay = (monthlyPrice: number, yearlyPrice: number) => {
    if (isYearly) {
      const monthlyEquivalent = yearlyPrice / 12;
      return `$${monthlyEquivalent.toFixed(2)} a month`;
    }
    return `$${monthlyPrice} a month`;
  };

  const getPeriod = () => (isYearly ? "yearly" : "monthly");

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
          <div className="flex flex-row gap-2 items-center justify-center">
            <h2 className="text-2xl font-bold text-gray-700 font-cursive">
              for just one
            </h2>
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
            <h2 className="text-2xl font-bold text-gray-700 font-cursive">
              a month
            </h2>
          </div>
          <Card className="p-6 relative overflow-hidden ring-2 ring-blue-500/20 rounded-2xl">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">
                <span className="text-blue-500 text-3xl font-cursive mr-1">
                  Plus
                </span>{" "}
                Plan
                {isYearly && (
                  <Badge className="ml-2 bg-green-500 text-white">
                    Save {PLUS_DISCOUNT_PERCENT}%
                  </Badge>
                )}
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  {formatPrice(PLUS_MONTHLY, PLUS_YEARLY)}
                </span>
                <span className="text-gray-500">/ {getPeriod()}</span>
              </div>
              {isYearly && (
                <p className="text-sm text-gray-500">
                  {getMonthlyDisplay(PLUS_MONTHLY, PLUS_YEARLY)}
                </p>
              )}
            </div>
            <div className="mt-6 space-y-3">
              {slackPlanFeatures.map((feature, index) => (
                <div
                  key={`slack-feature-${index}`}
                  className="flex items-center gap-2"
                >
                  <span>{feature.emoji}</span>
                  <span>{feature.title}</span>
                </div>
              ))}
            </div>
            <Link
              href={
                isYearly
                  ? "https://buy.stripe.com/eVaeXS8Fn1gtepGbIL"
                  : "https://buy.stripe.com/cN2g1W9Jr7ERdlC8ww"
              }
              target="_blank"
            >
              <Button className="w-full mt-6 bg-blue-500 hover:bg-blue-600 rounded-xl">
                Try Free
              </Button>
            </Link>
          </Card>

          <div className="text-center space-y-2 mt-6">
            <h2 className="text-2xl font-bold">or get the full package</h2>
            {/* <p className="text-gray-500 font-cursive text-2xl font-extralight">Become an open source supporter 🔥</p> */}
          </div>
          <div className="flex flex-row gap-2 items-center justify-center">
            <h2 className="text-2xl font-bold text-gray-700 font-cursive">
              for just one
            </h2>
            <div className="relative">
              <div className="animate-float rotate-3 hover:rotate-6 transition-transform">
                <picture>
                  <source
                    srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f35c/512.webp"
                    type="image/webp"
                  />
                  <img
                    src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f35c/512.gif"
                    alt="🍜"
                    width="64"
                    height="64"
                  />
                </picture>

                {/* <p className="text-2xl text-gray-500 font-bold font-cursive absolute bottom-[-10px] left-[calc(50%-5px)] translate-x-[-50%]">
                  latte
                </p> */}
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-700 font-cursive">
              a month
            </h2>
          </div>
          <Card className="p-6 relative overflow-hidden ring-2 ring-indigo-500/20 rounded-2xl">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">
                <span className="text-indigo-500 text-3xl font-cursive mr-1">
                  Supporter
                </span>{" "}
                Plan
                {isYearly && (
                  <Badge className="ml-2 bg-green-500 text-white">
                    Save {SUPPORTER_DISCOUNT_PERCENT}%
                  </Badge>
                )}
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  {formatPrice(SUPPORTER_MONTHLY, SUPPORTER_YEARLY)}
                </span>
                <span className="text-gray-500">/ {getPeriod()}</span>
              </div>
              {isYearly && (
                <p className="text-sm text-gray-500">
                  {getMonthlyDisplay(SUPPORTER_MONTHLY, SUPPORTER_YEARLY)}
                </p>
              )}
            </div>
            <div className="mt-6 space-y-3">
              {peoplePlanFeatures.map((feature, index) => (
                <div
                  key={`people-feature-${index}`}
                  className="flex items-center gap-2"
                >
                  <span>{feature.emoji}</span>
                  <span>{feature.title}</span>
                </div>
              ))}
            </div>
            <Link
              href={
                isYearly
                  ? "https://buy.stripe.com/28o6rmbRz5wJftK6oq"
                  : "https://buy.stripe.com/5kA1721cVe3fftK145"
              }
              target="_blank"
            >
              <Button className="w-full mt-6 bg-indigo-500 hover:bg-indigo-600 rounded-xl">
                Try Free
              </Button>
            </Link>
          </Card>
        </div>

        <div className="text-center space-y-2 pt-6">
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
            <span className="text-green-500">{MAX_DISCOUNT}%</span> discount for
            our early supporters
          </h2>
          <span className="text-sm text-gray-500 mt-1">
            and maybe some day we can go full time :)
          </span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-md text-gray-500">Monthly</span>
          <Switch checked={isYearly} onCheckedChange={setIsYearly} />
          <span className="text-md text-gray-500">Yearly</span>
          <span className="text-sm text-green-500 ml-1">discounted</span>
        </div>

        <Divider className="my-6 mt-24" />
        <FAQ />
      </div>
    </AppleLikePopover>
  );
};
