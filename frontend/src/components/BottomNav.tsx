"use client";

import React, { useState, useEffect } from "react";
import { ChartArea, ChartGantt, Eclipse, Eye, Flame, Home, Loader2, Pencil, PlusSquare, Route, ScanFace, Search, Sparkle, Sprout, User } from "lucide-react";
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
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const userData = userDataQuery.data;
  const userUsername = userData?.user?.username ?? "me";
  const pathname = usePathname();

  const isActiveRoute = (route: string) => {
    if (route === '/') return pathname === '/';
    return pathname.startsWith(route);
  };

  useEffect(() => {
    setIsLoadingFeed(false);
    setIsLoadingPlans(false);
    setIsLoadingLog(false);
    setIsLoadingInsights(false);
    setIsLoadingProfile(false);
  }, [pathname]);

  return (
    <>
      <FloatingActionMenu />
      <nav className="fixed bottom-0 left-0 right-0 bg-transparent backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-[50]">
        <div className="flex justify-around items-center py-2 px-4 max-w-screen-xl mx-auto">
          <Link
            href="/"
            className={`flex flex-col justify-center items-center p-2 transition-all duration-200 ${
              isActiveRoute('/') 
              ? 'text-blue-500 scale-110 -translate-y-0.5' 
              : 'text-gray-500 hover:text-gray-700'
            } relative`}
            onClick={() =>{
              if (pathname !== "/")  {
                setIsLoadingFeed(true)
              }
            }}
          >
            {isLoadingFeed ? <Loader2 size={24} className="animate-spin" /> : <Home size={24} strokeWidth={2.5} />}
            {notificationCount > 0 && (
              <div className="absolute top-0 right-0 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-[10px] font-bold">
                {notificationCount > 99 ? '99+' : notificationCount}
              </div>
            )}
            <span className="text-[10px] mt-1 font-medium">{isActiveRoute('/') ? 'Home' : ''}</span>
          </Link>
          <Link
            href="/plans"
            className={`flex flex-col justify-center items-center p-2 transition-all duration-200 ${
              isActiveRoute('/plans') 
              ? 'text-blue-500 scale-110 -translate-y-0.5' 
              : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => {
              if (pathname !== "/plans") {
                setIsLoadingPlans(true)
              }
            }}
          >
            {isLoadingPlans ? <Loader2 size={24} className="animate-spin" /> : <ChartArea size={24} strokeWidth={2.5} />}
            <span className="text-[10px] mt-1 font-medium">{isActiveRoute('/plans') ? 'Plans' : ''}</span>
          </Link>
          <Link
            href="/add"
            className={`flex flex-col justify-center items-center p-2 transition-all duration-200 ${
              isActiveRoute('/add') 
              ? 'text-blue-500 scale-110 -translate-y-0.5' 
              : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => {
              if (pathname !== "/add") {
                setIsLoadingLog(true)
              }
            }}
          >
            {isLoadingLog ? <Loader2 size={30} className="animate-spin" /> : 
            <div className="bg-blue-500 rounded-full p-2">
              <PlusSquare size={24} strokeWidth={2.5} className="text-white" />
            </div>
            }
            <span className="text-[10px] mt-1 font-medium">{isActiveRoute('/add') ? 'Add' : ''}</span>
          </Link>
          <Link
            href="/insights"
            className={`flex flex-col justify-center items-center p-2 transition-all duration-200 ${
              isActiveRoute('/insights') 
              ? 'text-blue-500 scale-110 -translate-y-0.5' 
              : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => {
              if (!pathname.startsWith("/insights")) {
                setIsLoadingInsights(true)
              }
            }}
          >
            {isLoadingInsights ? <Loader2 size={24} className="animate-spin" /> : <ScanFace size={24} strokeWidth={2.5} />}
            <span className="text-[10px] mt-1 font-medium">{isActiveRoute('/insights') ? 'Insights' : ''}</span>
          </Link>
          <Link
            href={`/profile/${userUsername}`}
            className={`flex flex-col justify-center items-center p-2 transition-all duration-200 ${
              isActiveRoute('/profile') 
              ? 'text-blue-500 scale-110 -translate-y-0.5' 
              : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => {
              if (pathname !== `/profile/${userUsername}`) {
                setIsLoadingProfile(true)
              }
            }}
          >
            {isLoadingProfile ? <Loader2 size={24} className="animate-spin" /> : <User size={24} strokeWidth={2.5} />}
            <span className="text-[10px] mt-1 font-medium">{isActiveRoute('/profile') ? 'Profile' : ''}</span>
          </Link>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
