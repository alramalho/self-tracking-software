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
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useNotifications } from "@/hooks/useNotifications";
import Link from "next/link";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const HomePage: React.FC = () => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { useCurrentUserDataQuery, hasLoadedUserData, refetchAllData } =
    useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { isAppInstalled } = useNotifications();
  const [onboardingCompleted] = useLocalStorage<boolean>(
    "onboarding-completed",
    false
  );

  const hasNoFriends = userData?.user?.friend_ids?.length === 0;

  useEffect(() => {
    if (isSignedIn && hasLoadedUserData && !onboardingCompleted) {
      router.push("/onboarding");
    }
  }, [userData, isSignedIn]);

  const handleUserClick = (user: UserSearchResult) => {
    router.push(`/profile/${user.username}`);
    setIsSearchOpen(false);
  };

  const handleRefresh = async () => {
    await refetchAllData();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center">
        {isAppInstalled ? (
          <div className="flex flex-row gap-3 items-center text-center">
            <span className="mb-2 text-[40px]">🎯</span>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">
              <span className={`${variants.text} break-normal text-nowrap`}>
                tracking.<span className={`${variants.fadedText}`}>so</span>
              </span>
            </h2>
          </div>
        ) : (
          <Link href="/download">
            <Button className="mb-2">Download App</Button>
          </Link>
        )}
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
        <TimelineRenderer onOpenSearch={() => setIsSearchOpen(true)} />
      </div>

      <AppleLikePopover
        onClose={() => setIsSearchOpen(false)}
        open={isSearchOpen}
      >
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-4">Search Users</h2>
          <UserSearch onUserClick={handleUserClick} />
        </div>
      </AppleLikePopover>

      {/* <DailyCheckinBanner/> */}
    </div>
  );
};

export default HomePage;
