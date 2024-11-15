"use client";

import React, { useEffect, useState } from "react";
import UserSearch, { UserSearchResult } from "@/components/UserSearch";
import { useRouter } from "next/navigation";
import TimelineRenderer from "@/components/TimelineRenderer";
import AppleLikePopover from "@/components/AppleLikePopover";
import {
  Apple,
  MoreVertical,
  Plus,
  PlusSquare,
  Search,
  Share,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import Notifications from "@/components/Notifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useSession } from "@clerk/nextjs";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { Loader2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

const HomePage: React.FC = () => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { useUserDataQuery, hasLoadedUserData } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  const { isAppInstalled } = useNotifications();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (
      isSignedIn &&
      hasLoadedUserData &&
      userData?.plans?.length === 0
    ) {
      router.push("/onboarding");
    }
  }, [userData, isSignedIn, hasLoadedUserData]);

  if (!isSignedIn) {
    router.push("/signin");
  }

  if (!hasLoadedUserData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="ml-3">Loading your data...</p>
      </div>
    );
  }

  const handleUserClick = (user: UserSearchResult) => {
    router.push(`/profile/${user.username}`);
    setIsSearchOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-row gap-3 items-center text-center">
          <span className="text-[40px]">🎯</span>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-gray-900">
            <span className="text-blue-500 break-normal text-nowrap">
              tracking.so<span className="text-blue-300">ftware</span>
            </span>
          </h2>
        </div>
        <button
          onClick={() => setIsSearchOpen(true)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
        >
          <Search size={24} />
        </button>
      </div>

      <Notifications />

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">
          Friend&apos;s last activities
        </h2>
        <TimelineRenderer />
      </div>

      {isSearchOpen && (
        <AppleLikePopover onClose={() => setIsSearchOpen(false)}>
          <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Search Users</h2>
            <UserSearch onUserClick={handleUserClick} />
          </div>
        </AppleLikePopover>
      )}
    </div>
  );
};

export default HomePage;
