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
  const { notificationCount } = useNotifications();
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
  const isDesktop = useMediaQuery("(min-width: 768px)");

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

  return (
    <>
      {/* <FloatingActionMenu /> */}
      <nav className={cn(
        "box-border bg-transparent backdrop-blur-xl z-[50]",
        isDesktop 
          ? "fixed left-0 top-0 bottom-0 w-64 py-6 border-l border-gray-200 border-2"
          : "fixed bottom-0 left-0 right-0 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] pb-1"
      )}>
        <div className={cn(
          "max-w-screen-xl mx-auto",
          isDesktop 
            ? "flex flex-col justify-start items-stretch h-full px-4 space-y-2"
            : "flex justify-around items-center py-2 px-4"
        )}>
          <Link
            href="/"
            data-testid="nav-home"
            className={cn(
              "transition-all duration-200 relative",
              isDesktop 
                ? "flex items-center p-3 rounded-lg hover:bg-gray-100/50"
                : "flex flex-col justify-center items-center p-2",
              isActiveRoute("/")
                ? cn(
                    activeThemeClass, 
                    isDesktop ? "bg-gray-100/80" : "scale-110 -translate-y-0.5"
                  )
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => {
              if (pathname !== "/") {
                setIsLoadingFeed(true);
              }
            }}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              {isLoadingFeed ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Home size={24} strokeWidth={2.5} />
              )}
            </div>
            {notificationCount > 0 && (
              <div className={cn(
                "absolute bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-[10px] font-bold",
                isDesktop ? "top-2 left-8" : "top-0 right-0"
              )}>
                {notificationCount > 99 ? "99+" : notificationCount}
              </div>
            )}
            <span className={cn(
              "font-medium",
              isDesktop 
                ? "text-sm" 
                : "text-[10px] mt-1",
              !isDesktop && !isActiveRoute("/") && "hidden"
            )}>
              Home
            </span>
          </Link>

          <Link
            href="/plans"
            data-testid="nav-plans"
            className={cn(
              "transition-all duration-200",
              isDesktop 
                ? "flex items-center p-3 rounded-lg hover:bg-gray-100/50"
                : "flex flex-col justify-center items-center p-2",
              isActiveRoute("/plans")
                ? cn(
                    activeThemeClass,
                    isDesktop ? "bg-gray-100/80" : "scale-110 -translate-y-0.5"
                  )
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => {
              if (pathname !== "/plans") {
                setIsLoadingPlans(true);
              }
            }}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              {isLoadingPlans ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <ChartArea size={24} strokeWidth={2.5} />
              )}
            </div>
            <span className={cn(
              "font-medium",
              isDesktop 
                ? "text-sm" 
                : "text-[10px] mt-1",
              !isDesktop && !isActiveRoute("/plans") && "hidden"
            )}>
              Plans
            </span>
          </Link>

          <Link
            href="/add"
            data-testid="nav-add"
            className={cn(
              "transition-all duration-200 relative",
              isDesktop 
                ? "flex items-center p-3 rounded-lg hover:bg-gray-100/50"
                : "flex flex-col justify-center items-center p-2",
              isActiveRoute("/add")
                ? cn(
                    activeThemeClass,
                    isDesktop ? "bg-gray-100/80" : "scale-110 -translate-y-0.5"
                  )
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => {
              if (pathname !== "/add") {
                setIsLoadingLog(true);
              }
            }}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              {isLoadingLog ? (
                <Loader2 size={30} className="animate-spin" />
              ) : isDesktop ? (
                <PlusSquare size={24} strokeWidth={2.5} className={cn(isDesktop ? "" : activeThemeClass)} />
              ) : (
                <div className={`${!isDesktop ? themeColors.primary : "bg-gray-100/80"} rounded-full p-2`}>
                  <PlusSquare
                    size={24}
                    strokeWidth={2.5}
                    className="text-white"
                  />
                </div>
              )}
            </div>
            <span className={cn(
              "font-medium",
              isDesktop 
                ? "text-sm" 
                : "text-[10px] mt-1",
              !isDesktop && !isActiveRoute("/add") && "hidden"
            )}>
              Add
            </span>
          </Link>

          <Link
            href="/insights/dashboard"
            data-testid="nav-insights"
            className={cn(
              "relative transition-all duration-200",
              isDesktop 
                ? "flex items-center p-3 rounded-lg hover:bg-gray-100/50"
                : "flex flex-col justify-center items-center p-2",
              isActiveRoute("/insights")
                ? cn(
                    activeThemeClass,
                    isDesktop ? "bg-gray-100/80" : "scale-110 -translate-y-0.5"
                  )
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => {
              if (!pathname.startsWith("/insights")) {
                setIsLoadingInsights(true);
              }
            }}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              {isLoadingInsights ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <ScanFace size={24} strokeWidth={2.5} />
              )}
            </div>
            <span className={cn(
              "font-medium",
              isDesktop 
                ? "text-sm" 
                : "text-[10px] mt-1",
              !isDesktop && !isActiveRoute("/insights") && "hidden"
            )}>
              AI Insights
            </span>
            {hasCheckinNotification && (
              <div className={cn(
                "absolute z-10",
                isDesktop ? "top-2 left-8" : "top-0 right-0"
              )}>
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
              "relative transition-all duration-200",
              isDesktop 
                ? "flex items-center p-3 rounded-lg hover:bg-gray-100/50"
                : "flex flex-col justify-center items-center p-2",
              isActiveRoute("/profile")
                ? cn(
                    activeThemeClass,
                    isDesktop ? "bg-gray-100/80" : "scale-110 -translate-y-0.5"
                  )
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => {
              if (!pathname.startsWith(`/profile/${userUsername}`)) {
                setIsLoadingProfile(true);
              }
            }}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              {isLoadingProfile ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <User size={24} strokeWidth={2.5} />
              )}
            </div>
            <span className={cn(
              "font-medium",
              isDesktop 
                ? "text-sm" 
                : "text-[10px] mt-1",
              !isDesktop && !isActiveRoute("/profile") && "hidden"
            )}>
              Profile
            </span>
          </Link>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
