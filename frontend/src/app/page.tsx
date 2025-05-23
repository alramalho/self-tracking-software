"use client";

import React, { useEffect, useState } from "react";
import UserSearch, { UserSearchResult } from "@/components/UserSearch";
import { useRouter } from "next/navigation";
import TimelineRenderer from "@/components/TimelineRenderer";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Search, Bell } from "lucide-react";
import Notifications from "@/components/Notifications";
import { Button } from "@/components/ui/button";
import PlanStreak from "@/components/PlanStreak";

import { useSession } from "@clerk/nextjs";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useNotifications } from "@/hooks/useNotifications";
import Link from "next/link";

const HomePage: React.FC = () => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { useCurrentUserDataQuery, hasLoadedUserData, notificationsData } =
    useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { isAppInstalled, clearGeneralNotifications } = useNotifications();
  const [onboardingCompleted] = useLocalStorage<boolean>(
    "onboarding-completed",
    false
  );

  const hasFriends =
    userData?.user?.friend_ids?.length &&
    userData?.user?.friend_ids?.length > 0;

  const unreadNotificationsCount = 
    notificationsData.data?.notifications?.filter(n => !n.opened_at).length || 0;

  useEffect(() => {
    if (
      isSignedIn &&
      hasLoadedUserData &&
      !onboardingCompleted &&
      !hasFriends
    ) {
      router.push("/onboarding");
    }
  }, [userData, isSignedIn]);

  const handleUserClick = (user: UserSearchResult) => {
    router.push(`/profile/${user.username}`);
    setIsSearchOpen(false);
  };

  const handleNotificationsClose = async () => {
    setIsNotificationsOpen(false);
    await clearGeneralNotifications();
    // Optionally refetch notifications to update the UI
    await notificationsData.refetch();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-4">
      <div
        className={`flex justify-between items-center ring-2 ring-gray-200 backdrop-blur-sm rounded-lg bg-white/60 shadow-sm p-4`}
      >
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
            <Button>Download App</Button>
          </Link>
        )}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 relative"
            >
              <Bell size={24} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <Search size={24} />
          </button>
        </div>
      </div>

      {/* Plan Streaks Section */}
      {userData?.plans && userData.plans.length > 0 && (
        <div className="ring-2 ring-gray-200 backdrop-blur-sm rounded-lg bg-white/60 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Your Streaks</h3>
            <button
              onClick={() => router.push(`/profile/${userData.user?.username}`)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              View Details
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {userData.plans.map((plan) => (
              <PlanStreak
                key={plan.id}
                plan={plan}
                activities={userData.activities || []}
                activityEntries={userData.activityEntries || []}
                size="medium"
                timeRangeDays={60}
                onClick={() => router.push(`/profile/${userData.user?.username}`)}
              />
            ))}
          </div>
        </div>
      )}

      <Notifications />

      <div className="mb-6">
        <TimelineRenderer onOpenSearch={() => setIsSearchOpen(true)} />
      </div>

      <AppleLikePopover
        onClose={() => setIsSearchOpen(false)}
        open={isSearchOpen}
        title="Search Users"
      >
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-4">Search Users</h2>
          <UserSearch onUserClick={handleUserClick} />
        </div>
      </AppleLikePopover>

      <AppleLikePopover
        onClose={handleNotificationsClose}
        open={isNotificationsOpen}
        title="Notifications"
      >
        <div className="p-4">
          <div className="flex items-start flex-col justify-between mb-4">
            <h2 className="text-xl font-semibold">{unreadNotificationsCount > 0 ? "Notifications" : "✅ No new notifications"}</h2>
          </div>
          <Notifications />
        </div>
      </AppleLikePopover>

      {/* <DailyCheckinBanner/> */}
    </div>
  );
};

export default HomePage;
