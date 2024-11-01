"use client";

import React from "react";
import { ChartGantt, Eye, Flame, Home, Pencil, Route, Search, Sparkle, Sprout, User } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "@clerk/clerk-react";
import Link from "next/link";
import { useUserPlan } from "@/contexts/UserPlanContext";

const BottomNav = () => {
  const { notificationCount } = useNotifications();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t-2 z-[1000]">
      <div className="flex justify-around">
        <Link
          href="/feed"
          className="flex flex-col items-center p-2 text-gray-600 hover:text-blue-500"
        >
          <Flame size={24}/>
          <span className="text-xs mt-1">Feed</span>
        </Link>
        <Link
          href="/plans"
          className="flex flex-col items-center p-2 text-gray-600 hover:text-blue-500"
        >
          <ChartGantt size={24} />
          <span className="text-xs mt-1">Plans</span>
        </Link>
        <Link
          href="/log"
          className="flex flex-col items-center p-2 text-gray-600 hover:text-blue-500"
        >
          <Pencil size={24} />
          <span className="text-xs mt-1">Log</span>
        </Link>
        <Link
          href={`/profile/me`}
          className="flex flex-col items-center p-2 text-gray-600 hover:text-blue-500 relative"
        >
          <User size={24} />
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
