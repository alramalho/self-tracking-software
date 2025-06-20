"use client";

import React, { useState } from "react";
import {
  CalendarDays,
  PersonStanding,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { useOnboarding } from "../OnboardingContext";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useShare } from "@/hooks/useShare";
import { useClipboard } from "@/hooks/useClipboard";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import AppleLikePopover from "@/components/AppleLikePopover";
import { ProfileSetupDynamicUI } from "@/components/ProfileSetupDynamicUI";
import { ApSearchComponent } from "@/components/ApSearch";
import { useUserPlan } from "@/contexts/UserPlanContext";

const OptionCard = ({
  isSelected,
  onClick,
  icon,
  title,
  description,
}: {
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-full p-6 rounded-xl border-2 transition-all duration-200 text-left ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            isSelected ? "bg-blue-100" : "bg-gray-100"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3
            className={`text-lg font-semibold ${
              isSelected ? "text-blue-900" : "text-gray-900"
            }`}
          >
            {title}
          </h3>
          <p
            className={`text-sm mt-1 ${
              isSelected ? "text-blue-700" : "text-gray-600"
            }`}
          >
            {description}
          </p>
        </div>
      </div>
    </button>
  );
};

export const HumanPartnerFinder = () => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const hasProfile = userData?.user?.profile !== undefined;
  const { shareOrCopyReferralLink } = useShareOrCopy();
  const [profileSetupPopupOpen, setProfileSetupPopoverOpen] = useState(false);
  const [apSearchPopupOpen, setApSearchPopupOpen] = useState(false);

  return (
    <>
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <PersonStanding className="w-20 h-20 text-blue-600" />
            <h2 className="text-2xl mt-2 font-bold tracking-tight text-gray-900">
              Let&apos;s find you a human partner
            </h2>
          </div>
          <p className="text-md text-gray-600">
            How would you like to structure your activities?
          </p>
        </div>

        <OptionCard
          isSelected={true}
          onClick={shareOrCopyReferralLink}
          icon={<Send className="w-6 h-6" />}
          title="Invite a friend"
          description="Send your personal link to your friends, family and colleagues"
        />
        <OptionCard
          isSelected={false}
          onClick={() => {
            if (hasProfile) {
              setApSearchPopupOpen(true);
            } else {
              setProfileSetupPopoverOpen(true);
            }
          }}
          icon={<Search className="w-6 h-6" />}
          title="Find one in our community"
          description="Browse through the pool of people of similar age & goals."
        />
      </div>
      <AppleLikePopover
        open={profileSetupPopupOpen}
        onClose={() => {
          setProfileSetupPopoverOpen(false);
        }}
      >
        <ProfileSetupDynamicUI
          submitButtonText="Save Profile"
          onSubmit={async () => {
            setProfileSetupPopoverOpen(false);
            setApSearchPopupOpen(true);
          }}
        />
      </AppleLikePopover>
      <AppleLikePopover
        open={apSearchPopupOpen}
        onClose={() => {
          setApSearchPopupOpen(false);
        }}
      >
        <ApSearchComponent />
      </AppleLikePopover>
    </>
  );
};
