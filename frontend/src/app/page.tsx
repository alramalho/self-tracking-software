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
import Link from "next/link";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { Loader2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { usePostHog } from "posthog-js/react";

const HomePage: React.FC = () => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { useUserDataQuery, hasLoadedUserData } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  const { isAppInstalled } = useNotifications();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAppInstallModalOpen, setIsAppInstallModalOpen] = useState(
    !isAppInstalled
  );
  const posthog = usePostHog();

  useEffect(() => {
    if (isSignedIn && userData?.user) {
      console.log("identified user in posthog ", userData?.user.id);
      posthog.identify(userData?.user.id, {
        email: userData?.user.email,
        name: userData?.user.name,
        username: userData?.user.username,
      });
    }
    if (
      isSignedIn &&
      hasLoadedUserData &&
      !isAppInstalled &&
      userData?.plans?.length === 0
    ) {
      router.push("/onboarding");
    }
  }, [userData, isSignedIn, hasLoadedUserData]);

  if (!isSignedIn) {
    router.push("/signin");
  }

  if (!userData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="ml-3">Loading your data...</p>
      </div>
    );
  }
  if (isAppInstallModalOpen) {
    return (
      <div className="h-screen w-screen absolute flex flex-col items-center justify-center px-4 z-50 bg-white overflow-hidden">
        <button
          onClick={() => setIsAppInstallModalOpen(false)}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          aria-label="Close"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        <Smartphone className="w-16 h-16 mb-6 text-gray-600" />
        <h2 className="text-2xl font-semibold mb-4 text-center">
          Please install the App to see this page
        </h2>
        <p className="text-gray-600 text-center mb-8 max-w-md">
          This will also enhance your experience and allow you to access
          features like notifications.
        </p>

        <div className="w-full max-w-md">
          <Tabs defaultValue="ios" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ios">
                <Apple size={16} className="inline mr-2" />
                iPhone / iPad
              </TabsTrigger>
              <TabsTrigger value="android">
                <Smartphone size={16} className="inline mr-2" />
                Android
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ios" className="bg-gray-50 p-4 rounded-lg mt-4">
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>
                  Click on the <Share className="inline w-5 h-5" /> button
                </li>
                <li>
                  Scroll down and click on &quot;Add to Home Screen{" "}
                  <PlusSquare className="inline w-5 h-5" />
                  &quot;
                </li>
              </ol>
            </TabsContent>
            <TabsContent
              value="android"
              className="bg-gray-50 p-4 rounded-lg mt-4"
            >
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>Open Chrome browser</li>
                <li>
                  Tap the menu <MoreVertical className="inline w5 h-5" />
                </li>
                <li>
                  Tap &quot;Install app&quot; or &quot;Add to Home screen&quot;
                </li>
                <li>Follow the prompts to install</li>
              </ol>
            </TabsContent>
          </Tabs>
        </div>
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
        <h1 className="text-2xl font-bold">Feed</h1>
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
