"use client";

import React, { useEffect, useState } from "react";
import UserSearch, { UserSearchResult } from "@/components/UserSearch";
import { useRouter } from "next/navigation";
import TimelineRenderer from "@/components/TimelineRenderer";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Search, RefreshCw } from "lucide-react";
import Notifications from "@/components/Notifications";
import { Button } from "@/components/ui/button";

import { useSession } from "@clerk/nextjs";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { Loader2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import Link from "next/link";

const HomePage: React.FC = () => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { useUserDataQuery, hasLoadedUserData, refetchAllData } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (
      isSignedIn &&
      hasLoadedUserData &&
      userData?.plans?.length === 0 &&
      userData?.activities?.length === 0
    ) {
      router.push("/onboarding");
    }
  }, [userData, isSignedIn, hasLoadedUserData]);

  if (!isSignedIn) {
    router.push("/signin");
  }

  const [showServerMessage, setShowServerMessage] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowServerMessage(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  if (!hasLoadedUserData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin mr-3" />
        <div className="flex flex-col items-start">
          <p className="text-left">Loading your data...</p>
          {showServerMessage && (
            <span className="text-gray-500 text-sm text-left">
              we run on cheap servers...
              <br />
              <Link
                target="_blank"
                href="https://ko-fi.com/alexramalho"
                className="underline"
              >
                donate?
              </Link>
            </span>
          )}
        </div>
      </div>
    );
  }

  const handleUserClick = (user: UserSearchResult) => {
    router.push(`/profile/${user.username}`);
    setIsSearchOpen(false);
  };

  const handleRefresh = async () => {
    await refetchAllData();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-row gap-3 items-center text-center">
          <span className="mb-2 text-[40px]">🎯</span>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">
            <span className="text-blue-500 break-normal text-nowrap">
              tracking.<span className="text-blue-300">so</span>
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm text-gray-500">Refresh</span>
          </Button>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <Search size={24} />
          </button>
        </div>
      </div>

      <Notifications />

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">
          Friend&apos;s last activities
        </h2>
        {userData?.user?.friend_ids.length === 0 && (
          <div className="text-left text-gray-500">
            You haven&apos;t added any friends yet.
          </div>
        )}
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
