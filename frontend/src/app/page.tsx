"use client";

import React, { useEffect, useState } from 'react';
import UserSearch, { UserSearchResult } from '@/components/UserSearch';
import { useRouter } from 'next/navigation';
import TimelineRenderer from "@/components/TimelineRenderer";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Search } from 'lucide-react';
import Notifications from '@/components/Notifications';

import { useSession } from "@clerk/nextjs";
import Link from "next/link";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { Loader2 } from "lucide-react";

const HomePage: React.FC = () => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { userData} = useUserPlan();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (isSignedIn && userData && userData["me"]) {
      if (userData["me"].plans.length === 0) {
        router.push("/onboarding");
      } 
    }
  }, [userData, router, isSignedIn]);

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <h1 className="text-3xl font-light text-gray-800 mb-6">
          welcome to self.tracking.so
        </h1>
        <Link
          href="/signin"
          className="bg-black text-white font-normal py-2 px-6 rounded hover:bg-gray-800 transition-colors duration-200"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!userData || !userData["me"]) {
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
        <h2 className="text-lg font-semibold mb-4">Friend&apos;s last activities</h2>
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
