"use client";

import React, { useState, useEffect } from "react";
import {
  ChartArea,
  Home,
  Loader2,
  PlusSquare,
  ScanFace,
  User,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import Link from "next/link";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { usePathname } from "next/navigation";
import FloatingActionMenu from "./FloatingActionMenu";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { BaseThemeColor } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "./ui/badge";
import { useDailyCheckin } from "@/contexts/DailyCheckinContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// This forces Tailwind to include these classes in the build
const themeTextClasses: Record<BaseThemeColor, string> = {
  slate: "text-slate-500",
  blue: "text-blue-500",
  violet: "text-violet-500",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
  rose: "text-rose-500",
};

const BottomNav = () => {
  const { notificationCount, profileNotificationCount } = useNotifications();
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const { useCurrentUserDataQuery } = useUserPlan();
  const userDataQuery = useCurrentUserDataQuery();
  const userData = userDataQuery.data;
  const userUsername = userData?.user?.username;
  const pathname = usePathname();
  const themeColors = useThemeColors();
  const { effectiveTheme } = useTheme();
  const { shouldShowNotification: hasCheckinNotification } = useDailyCheckin();

  const isActiveRoute = (route: string) => {
    if (route === "/") return pathname === "/";
    return pathname.startsWith(route);
  };

  useEffect(() => {
    setIsLoadingFeed(false);
    setIsLoadingPlans(false);
    setIsLoadingLog(false);
    setIsLoadingInsights(false);
    setIsLoadingProfile(false);
  }, [pathname]);

  if (!userUsername) {
    return null;
  }

  const activeThemeClass = themeTextClasses[effectiveTheme];
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <>
      <FloatingActionMenu />
      <nav className={`box-border fixed bottom-0 left-0 right-0 bg-transparent backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-[50] pb-1 ${isDesktop ? "max-w-2xl rounded-t-xl mx-auto" : ""}`}>
        <div className="flex justify-around items-center py-2 px-4 max-w-screen-xl mx-auto">
          <Link
            href="/"
            data-testid="nav-home"
            className={cn(
              "flex flex-col justify-center items-center p-2 transition-all duration-200 relative",
              isActiveRoute("/")
                ? cn(activeThemeClass, "scale-110 -translate-y-0.5")
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => {
              if (pathname !== "/") {
                setIsLoadingFeed(true);
              }
            }}
          >
            {isLoadingFeed ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <Home size={24} strokeWidth={2.5} />
            )}
            {notificationCount > 0 && (
              <div className="absolute top-0 right-0 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-[10px] font-bold">
                {notificationCount > 99 ? "99+" : notificationCount}
              </div>
            )}
            <span className="text-[10px] mt-1 font-medium">
              {isActiveRoute("/") ? "Home" : ""}
            </span>
          </Link>

          <Link
            href="/plans"
            data-testid="nav-plans"
            className={cn(
              "flex flex-col justify-center items-center p-2 transition-all duration-200",
              isActiveRoute("/plans")
                ? cn(activeThemeClass, "scale-110 -translate-y-0.5")
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => {
              if (pathname !== "/plans") {
                setIsLoadingPlans(true);
              }
            }}
          >
            {isLoadingPlans ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <ChartArea size={24} strokeWidth={2.5} />
            )}
            <span className="text-[10px] mt-1 font-medium">
              {isActiveRoute("/plans") ? "Plans" : ""}
            </span>
          </Link>

          <Link
            href="/add"
            data-testid="nav-add"
            className={cn(
              "flex flex-col justify-center items-center p-2 transition-all duration-200 relative",
              isActiveRoute("/add")
                ? cn(activeThemeClass, "scale-110 -translate-y-0.5")
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => {
              if (pathname !== "/add") {
                setIsLoadingLog(true);
              }
            }}
          >
            {isLoadingLog ? (
              <Loader2 size={30} className="animate-spin" />
            ) : (
              <div className={`${themeColors.primary} rounded-full p-2`}>
                <PlusSquare
                  size={24}
                  strokeWidth={2.5}
                  className="text-white"
                />
              </div>
            )}
            <span className="text-[10px] mt-1 font-medium">
              {isActiveRoute("/add") ? "Add" : ""}
            </span>
          </Link>

          <Link
            href="/insights/dashboard"
            data-testid="nav-insights"
            className={cn(
              "relative flex flex-col justify-center items-center p-2 transition-all duration-200",
              isActiveRoute("/insights")
                ? cn(activeThemeClass, "scale-110 -translate-y-0.5")
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => {
              if (!pathname.startsWith("/insights")) {
                setIsLoadingInsights(true);
              }
            }}
          >
              {isLoadingInsights ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <ScanFace size={24} strokeWidth={2.5} />
              )}
              <span className="text-[10px] mt-1 font-medium">
                {isActiveRoute("/insights") ? "AI Insights" : ""}
              </span>
              {hasCheckinNotification && (
                <div className="absolute top-0 right-0 z-10">
                  <Badge
                    variant="destructive"
                    className="h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    1
                  </Badge>
                </div>
              )}
          </Link>

          <Link
            href={`/profile/${userUsername}`}
            data-testid="nav-profile"
            className={cn(
              "relative flex flex-col justify-center items-center p-2 transition-all duration-200",
              isActiveRoute("/profile")
                ? cn(activeThemeClass, "scale-110 -translate-y-0.5")
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => {
              if (!pathname.startsWith(`/profile/${userUsername}`)) {
                setIsLoadingProfile(true);
              }
            }}
          >
            {isLoadingProfile ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <User size={24} strokeWidth={2.5} />
            )}
            {profileNotificationCount > 0 && (
              <div className="absolute top-0 right-0 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-[10px] font-bold">
                {profileNotificationCount > 99
                  ? "99+"
                  : profileNotificationCount}
              </div>
            )}
            <span className="text-[10px] mt-1 font-medium">
              {isActiveRoute("/profile") ? "Profile" : ""}
            </span>
          </Link>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
