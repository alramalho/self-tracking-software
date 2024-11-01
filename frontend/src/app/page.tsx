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
        {userData["me"].user?.name ? `, ${userData["me"].user.name}` : ""}. Here are your plans:
      </h1>

      <PlansRenderer />
    </div>
  );
};

export default HomePage;
