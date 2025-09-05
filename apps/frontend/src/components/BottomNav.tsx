"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useCurrentUser } from "@/contexts/users";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotifications } from "@/hooks/useNotifications";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { BaseLoweredThemeColor } from "@/utils/theme";
import {
  ChartArea,
  Home,
  PlusSquare,
  Search,
  User,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

// This forces Tailwind to include these classes in the build
const themeTextClasses: Record<BaseLoweredThemeColor, string> = {
  slate: "text-slate-500",
  blue: "text-blue-500",
  violet: "text-violet-500",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
  rose: "text-rose-500",
};

const BottomNav = () => {
  const { notificationCount } = useNotifications();
  const { currentUser } = useCurrentUser();
  const userUsername = currentUser?.username;
  const pathname = usePathname();
  const router = useRouter();
  const themeColors = useThemeColors();
  const { effectiveTheme } = useTheme();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const isActiveRoute = (route: string) => {
    if (route === "/") return pathname === "/";
    return pathname.startsWith(route);
  };

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
          <button
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
            onClick={() => router.push("/", { scroll: false })}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              <Home size={24} strokeWidth={2.5} />
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
          </button>

          <button
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
            onClick={() => router.push("/plans", { scroll: false })}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              <ChartArea size={24} strokeWidth={2.5} />
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
          </button>

          <button
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
            onClick={() => router.push("/add", { scroll: false })}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              {isDesktop ? (
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
          </button>

          <button
            data-testid="nav-search"
            className={cn(
              "relative transition-all duration-200",
              isDesktop 
                ? "flex items-center p-3 rounded-lg hover:bg-gray-100/50"
                : "flex flex-col justify-center items-center p-2",
              isActiveRoute("/ap-search")
                ? cn(
                    activeThemeClass,
                    isDesktop ? "bg-gray-100/80" : "scale-110 -translate-y-0.5"
                  )
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => router.push("/ap-search", { scroll: false })}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              <Search size={24} strokeWidth={2.5} />
            </div>
            <span className={cn(
              "font-medium",
              isDesktop 
                ? "text-sm" 
                : "text-[10px] mt-1",
              !isDesktop && !isActiveRoute("/ap-search") && "hidden"
            )}>
              Search
            </span>
          </button>

          <button
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
            onClick={() => router.push(`/profile/${userUsername}`, { scroll: false })}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              <User size={24} strokeWidth={2.5} />
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
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
