"use client";

import React, { useState, useEffect } from "react";
import { ChartArea, ChartGantt, Eclipse, Eye, Flame, Home, Loader2, Pencil, PlusSquare, Route, Search, Sparkle, Sprout, User } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "@clerk/clerk-react";
import Link from "next/link";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { usePathname, useRouter } from "next/navigation";
import FloatingActionMenu from "./FloatingActionMenu";

const BottomNav = () => {
  const { notificationCount } = useNotifications();
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsLoadingFeed(false);
    setIsLoadingPlans(false);
    setIsLoadingLog(false);
    setIsLoadingProfile(false);
    setIsLoadingAi(false);
  }, [pathname]);

  return (
    <>
      <FloatingActionMenu />
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-100/50 backdrop-blur-md shadow-lg border-t-2 border-gray-300 pb-2 z-[50]">
        <div className="flex justify-around">
          <Link
            href="/"
            className="flex flex-col justify-center items-center p-2 text-gray-600 relative"
            onClick={() =>{
              if (pathname !== "/")  {
                setIsLoadingFeed(true)
              }
            }}
          >
            {isLoadingFeed ? <Loader2 size={24} className="animate-spin" /> : <Home size={24} />}
            {notificationCount > 0 && (
              <div className="absolute top-1 right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-white text-[14px] font-bold -mt-1 -mr-1">
                {notificationCount > 99 ? '99+' : notificationCount}
              </div>
            )}
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link
            href="/plans"
            className="flex flex-col justify-center items-center p-2 text-gray-600"
            onClick={() => {
              if (pathname !== "/plans") {
                setIsLoadingPlans(true)
              }
            }}
          >
            {isLoadingPlans ? <Loader2 size={24} className="animate-spin" /> : <ChartArea size={24} />}
            <span className="text-xs mt-1">Plans</span>
          </Link>
          <Link
            href="/add"
            className="flex flex-col justify-center items-center p-2 text-gray-600"
            onClick={() => {
              if (pathname !== "/add") {
                setIsLoadingLog(true)
              }
            }}
          >
            {isLoadingLog ? <Loader2 size={30} className="animate-spin" /> : <PlusSquare size={30} />}
            <span className="text-xs mt-1">Add</span>
          </Link>
          <Link
            href={`/ai`}
            className="flex flex-col justify-center items-center p-2 text-gray-600 text-center"
            onClick={() => {
              if (pathname !== "/ai") {
                setIsLoadingAi(true)
              }
            }}
          >
            {isLoadingAi ? <Loader2 size={24} className="animate-spin" /> : <Eclipse size={24} />}
            <span className="text-xs mt-1">Coach</span>
          </Link>
          <Link
            href={`/profile/me`}
            className="flex flex-col justify-center items-center p-2 text-gray-600"
            onClick={() => {
              if (pathname !== "/profile/me") {
                setIsLoadingProfile(true)
              }
            }}
          >
            {isLoadingProfile ? <Loader2 size={24} className="animate-spin" /> : <User size={24} />}
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
