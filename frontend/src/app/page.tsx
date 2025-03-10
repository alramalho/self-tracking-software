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
import { useShare } from "@/hooks/useShare";
import { useClipboard } from "@/hooks/useClipboard";
import { toast } from "react-hot-toast";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { DailyCheckinBanner } from "@/components/DailyCheckinBanner";

const HomePage: React.FC = () => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const {
    useCurrentUserDataQuery,
    hasLoadedUserData,
    refetchAllData,
  } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { isSupported: isShareSupported, share } = useShare();
  const [copied, copyToClipboard] = useClipboard();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  useEffect(() => {
    if (
      isSignedIn &&
      hasLoadedUserData &&
      userData?.plans?.length === 0 &&
      userData?.activities?.length === 0
    ) {
      router.push("/onboarding");
    } 
  }, [
    userData,
    isSignedIn,
  ]);


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
        <div className="flex flex-row gap-3 items-center text-center">
          <span className="mb-2 text-[40px]">🎯</span>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">
            <span className={`${variants.text} break-normal text-nowrap`}>
              tracking.<span className={`${variants.fadedText}`}>so</span>
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
        {userData?.user?.friend_ids?.length === 0 ? (
          <>
            <div className="text-left text-gray-500">
              You haven&apos;t added any friends yet 🙁
              <br />
              <span className="text-sm text-gray-500">
                Studies show that having accountability partners{" "}
                <span className="font-bold">increases your chances of achieving goals by up to 95%!</span>
                <br />
                <br />
                Add friends to boost your success.
              </span>
              <span className="text-sm text-gray-500">
                <br />
                <br />
                <span
                  className="underline cursor-pointer"
                  onClick={() => setIsSearchOpen(true)}
                >
                  Search
                </span>{" "}
                for friends already using tracking.so, or invite new ones by{" "}
                <span
                  className="underline cursor-pointer"
                  onClick={async () => {
                    try {
                      const link = `https://app.tracking.so/join/${userData?.user?.username}`;
                      if (isShareSupported) {
                        const success = await share(link);
                        if (!success) throw new Error("Failed to share");
                      } else {
                        const success = await copyToClipboard(link);
                        if (!success) throw new Error("Failed to copy");
                        toast.success("Copied to clipboard");
                      }
                    } catch (error) {
                      console.error("Failed to copy link to clipboard");
                    }
                  }}
                >
                  sharing your profile link.
                </span>{" "}
              </span>
            </div>
          </>
        ) : (
          <TimelineRenderer onOpenSearch={() => setIsSearchOpen(true)} />
        )}
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

      <DailyCheckinBanner/>
    </div>
  );
};

export default HomePage;
