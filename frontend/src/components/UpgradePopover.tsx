import React, { useState, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Card } from "@/components/ui/card";
import { Check, Divide } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Brain, PlusSquare, Bell } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ } from "./FAQ";
import Divider from "./Divider";

interface FeatureItem {
  emoji: string;
  title: ReactNode;
}

interface UpgradePopoverProps {
  open: boolean;
  onClose: () => void;
}

const YEARLY_DISCOUNT = 0.51;
const YEARLY_DISCOUNT_PERCENT = Math.round((1 - YEARLY_DISCOUNT) * 100);

export const UpgradePopover: React.FC<UpgradePopoverProps> = ({
  open,
  onClose,
}) => {
  const [isYearly, setIsYearly] = useState(false);

  const slackPlanFeatures: FeatureItem[] = [
    { emoji: "✔️", title: <span>5 metrics</span> },
    { emoji: "✔️", title: <span>habit and lifestyle badges</span> },
    { emoji: "✔️", title: <span>account customization</span> },
  ];

  const peoplePlanFeatures: FeatureItem[] = [
    { emoji: "✔️", title: <span>everything in plus plan</span> },
    {
      emoji: "✔️",
      title: (
        <span>
          AI personal coach & insights{" "}
          <Badge className="bg-purple-500 text-white">BETA</Badge>
        </span>
      ),
    },
    { emoji: "✔️", title: <span>access to BETA features and voting</span> },
    { emoji: "✔️", title: <span>custom and unlimited metrics</span> },
    { emoji: "🔥", title: <span>exclusive open soruce supporter badge</span> },
  ];

  const formatPrice = (basePrice: number, cents: number) => {
    if (isYearly) {
      const yearlyBase = Math.floor(basePrice * 12 * YEARLY_DISCOUNT);
      return `$${yearlyBase}.${cents}`;
    }
    return `$${Math.floor(basePrice)}.${cents}`;
  };

  const getMonthlyDisplay = (basePrice: number, cents: number) => {
    if (isYearly) {
      const yearlyTotal = Number(
        `${Math.floor(basePrice * 12 * YEARLY_DISCOUNT)}.${cents}`
      );
      const monthlyEquivalent = yearlyTotal / 12;
      return `$${monthlyEquivalent.toFixed(2)} a month`;
    }
    return `$${basePrice}.${cents} a month`;
  };

  const getPeriod = () => (isYearly ? "yearly" : "monthly");

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="space-y-8 pt-6 pb-12">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Unlock this, and more</h2>
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
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{formatPrice(5, 99)}</span>
                <span className="text-gray-500">/ {getPeriod()}</span>
              </div>
              {isYearly && (
                <p className="text-sm text-gray-500">
                  {getMonthlyDisplay(5, 99)}
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
            <Button className="w-full mt-6 bg-blue-500 hover:bg-blue-600 rounded-xl">
              Try Free
            </Button>
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
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  {formatPrice(12, 98)}
                </span>
                <span className="text-gray-500">/ {getPeriod()}</span>
              </div>
              {isYearly && (
                <p className="text-sm text-gray-500">
                  {getMonthlyDisplay(12, 98)}
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
            <Button className="w-full mt-6 bg-indigo-500 hover:bg-indigo-600 rounded-xl">
              Try Free
            </Button>
          </Card>
        </div>

        <div className="text-center space-y-2 pt-6">
          <h2 className="text-xl font-bold">
            did we tell you about the{" "}
            <span className="text-green-500">{YEARLY_DISCOUNT_PERCENT}%</span>{" "}
            discount?
          </h2>
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
