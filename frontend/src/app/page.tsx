"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "@clerk/nextjs";
import Link from "next/link";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const PlansPage: React.FC = () => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { userData} = useUserPlan();

  useEffect(() => {
    if (isSignedIn && userData && userData["me"]) {
      if (userData["me"].plans.length === 0) {
        router.push("/onboarding");
      } else {
        router.push("/feed");
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

  return null;
};

export default PlansPage;