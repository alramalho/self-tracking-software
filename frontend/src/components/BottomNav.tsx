"use client";

import React, { useState, useEffect } from "react";
import { ChartGantt, Eye, Flame, Home, Loader2, Pencil, Route, Search, Sparkle, Sprout, User } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "@clerk/clerk-react";
import Link from "next/link";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { usePathname, useRouter } from "next/navigation";

const BottomNav = () => {
  const { notificationCount } = useNotifications();
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsLoadingFeed(false);
    setIsLoadingPlans(false);
    setIsLoadingLog(false);
    setIsLoadingProfile(false);
  }, [pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t-2 z-[1000] pb-1">
      <div className="flex justify-around">
        <Link
          href="/"
          className="flex flex-col items-center p-2 text-gray-600"
          onClick={() =>{
            if (pathname !== "/")  {
              setIsLoadingFeed(true)
            }
          }}
        >
          {isLoadingFeed ? <Loader2 size={24} className="animate-spin" /> : <Home size={24} />}
          <span className="text-xs mt-1">Home</span>
        </Link>
        <Link
          href="/plans"
          className="flex flex-col items-center p-2 text-gray-600"
          onClick={() => {
            if (pathname !== "/plans") {
              setIsLoadingPlans(true)
            }
          }}
        >
          {isLoadingPlans ? <Loader2 size={24} className="animate-spin" /> : <ChartGantt size={24} />}
          <span className="text-xs mt-1">Plans</span>
        </Link>
        <Link
          href="/log"
          className="flex flex-col items-center p-2 text-gray-600"
          onClick={() => {
            if (pathname !== "/log") {
              setIsLoadingLog(true)
            }
          }}
        >
          {isLoadingLog ? <Loader2 size={24} className="animate-spin" /> : <Pencil size={24} />}
          <span className="text-xs mt-1">Log</span>
        </Link>
        <Link
          href={`/profile/me`}
          className="flex flex-col items-center p-2 text-gray-600 relative"
          onClick={() => {
            if (pathname !== "/profile/me") {
              setIsLoadingProfile(true)
            }
          }}
        >
          {isLoadingProfile ? <Loader2 size={24} className="animate-spin" /> : <User size={24} />}
          {notificationCount > 0 && (
            <div className="absolute top-1 right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-white text-[14px] font-bold -mt-1 -mr-1">
              {notificationCount > 99 ? '99+' : notificationCount}
            </div>
          )}
          <span className="text-xs mt-1">Profile</span>
        </Link>
      </div>
    </nav>
  );
};

export default BottomNav;
