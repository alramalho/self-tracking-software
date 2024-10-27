"use client";

import React, { useState, useEffect } from "react";
import PlansRenderer from "@/components/PlansRenderer";
import { useSession } from "@clerk/nextjs";
import Link from "next/link";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";
import TimelineRenderer from "@/components/TimelineRenderer";
import AppleLikePopover from "@/components/AppleLikePopover";
import { ChevronRight, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Notifications from "@/components/Notifications";

const HomePage: React.FC = () => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { userData, setUserData, fetchUserData } = useUserPlan();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    if (userData && userData["me"] && userData["me"].plans.length == 0) {
      router.push("/onboarding");
    }
  }, [userData]);


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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        Welcome
        {userData["me"].user?.name ? `, ${userData["me"].user.name}` : ""}
      </h1>

    <Notifications />

      <div
        className="bg-white border-2 border-blue-200 p-4 rounded-lg mb-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200 flex items-center justify-between"
        onClick={() => setIsPopoverOpen(true)}
      >
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={userData["me"].user?.picture} alt="User Avatar" />
            <AvatarFallback>
              {userData["me"].user?.name?.[0] ||
                userData["me"].user?.username?.[0] ||
                "U"}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-lg font-semibold">Your plans</h2>
          <ChevronRight
            className={`transition-transform duration-300 ${
              isPopoverOpen ? "rotate-90" : ""
            } text-gray-500`}
            size={24}
          />
        </div>
      </div>

      <h1 className="text-lg font-bold mb-4">Last week</h1>
      <TimelineRenderer />

      {isPopoverOpen && (
        <AppleLikePopover onClose={() => setIsPopoverOpen(false)}>
          <PlansRenderer />
        </AppleLikePopover>
      )}
    </div>
  );
};

export default HomePage;
