import { useTheme } from "@/contexts/theme/useTheme";
import { useCurrentUser } from "@/contexts/users";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotifications } from "@/hooks/useNotifications";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { type BaseLoweredThemeColor } from "@/utils/theme";
import { Link, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  Home,
  Loader2,
  Plus,
  Search,
  User
} from "lucide-react";
import { useEffect, useState } from "react";

const scrollToTop = () => {
  // Scroll the main container (used by GeneralInitializer)
  const mainContainer = document.getElementById("main-scroll-container");
  if (mainContainer) {
    mainContainer.scrollTo({ top: 0, behavior: "smooth" });
  }
};

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
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const { currentUser } = useCurrentUser();
  const userUsername = currentUser?.username;
  const location = useLocation();
  const pathname = location.pathname;
  const themeColors = useThemeColors();
  const { effectiveTheme } = useTheme();
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
      <nav className={cn(
        "box-border backdrop-blur-xl z-[50] m-2 rounded-3xl border border-white/30 dark:border-gray-500/30",
        isDesktop
          ? "fixed left-0 top-0 bottom-0 w-64 py-6 border-l border-border border-2 bg-card"
          : "fixed bottom-0 left-0 right-0 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] pb-1 bg-transparent"
      )}>
        <div className={cn(
          "max-w-screen-xl mx-auto",
          isDesktop 
            ? "flex flex-col justify-start items-stretch h-full px-4 space-y-2"
            : "flex justify-around items-center py-2 px-4"
        )}>
          <Link
            to="/"
            preload="intent"
            data-testid="nav-home"
            className={cn(
              "transition-all duration-200 relative",
              isDesktop
                ? "flex items-center p-3 rounded-lg hover:bg-muted/50"
                : "flex flex-col justify-center items-center p-2",
              isActiveRoute("/")
                ? cn(
                    activeThemeClass,
                    isDesktop ? "bg-muted/80" : "scale-110 -translate-y-0.5"
                  )
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={(e) => {
              if (pathname === "/") {
                e.preventDefault();
                scrollToTop();
              } else {
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
              (!isDesktop && !isActiveRoute("/")) || isActiveRoute("/") ? "hidden" : ""
            )}>
              Home
            </span>
          </Link>

          <Link
            to="/plans"
            preload="intent"
            data-testid="nav-plans"
            className={cn(
              "transition-all duration-200",
              isDesktop
                ? "flex items-center p-3 rounded-lg hover:bg-muted/50"
                : "flex flex-col justify-center items-center p-2",
              isActiveRoute("/plans")
                ? cn(
                    activeThemeClass,
                    isDesktop ? "bg-muted/80" : "scale-110 -translate-y-0.5"
                  )
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={(e) => {
              if (pathname === "/plans") {
                e.preventDefault();
                scrollToTop();
              } else {
                setIsLoadingPlans(true);
              }
            }}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              {isLoadingPlans ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <BarChart3 size={24} strokeWidth={2.5} />
              )}
            </div>
            <span className={cn(
              "font-medium",
              isDesktop 
                ? "text-sm" 
                : "text-[10px] mt-1",
              (!isDesktop && !isActiveRoute("/plans")) || isActiveRoute("/plans") ? "hidden" : ""
            )}>
              Plans
            </span>
          </Link>

          <Link
            to="/add"
            preload="intent"
            data-testid="nav-add"
            className={cn(
              "transition-all duration-200 relative",
              isDesktop
                ? "flex items-center p-3 rounded-lg hover:bg-muted/50"
                : "flex flex-col justify-center items-center p-2",
              isActiveRoute("/add")
                ? cn(
                    activeThemeClass,
                    isDesktop ? "bg-muted/80" : "scale-110 -translate-y-0.5"
                  )
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={(e) => {
              if (pathname === "/add") {
                e.preventDefault();
                scrollToTop();
              } else {
                setIsLoadingLog(true);
              }
            }}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              {isLoadingLog ? (
                <Loader2 size={30} className="animate-spin" />
              ) : isDesktop ? (
                <Plus size={24} strokeWidth={2.5} className={cn(isDesktop ? "" : activeThemeClass)} />
              ) : (
                <div className={cn(
                  `rounded-full p-2 ${themeColors.primary}`,
                  isActiveRoute("/add") 
                    && `ring-2 ring-offset-2 ${themeColors.ring} ${themeColors.ringOffset}`
                )}>
                  <Plus
                    size={24}
                    strokeWidth={2.5}
                    className={"text-white"}
                  />
                </div>
              )}
            </div>
            <span className={cn(
              "font-medium",
              isDesktop 
                ? "text-sm" 
                : "text-[10px] mt-1",
              (!isDesktop && !isActiveRoute("/add")) || isActiveRoute("/add") ? "hidden" : ""
            )}>
              Add
            </span>
          </Link>

          <Link
            to="/search"
            preload="intent"
            data-testid="nav-search"
            className={cn(
              "relative transition-all duration-200",
              isDesktop
                ? "flex items-center p-3 rounded-lg hover:bg-muted/50"
                : "flex flex-col justify-center items-center p-2",
              isActiveRoute("/search")
                ? cn(
                    activeThemeClass,
                    isDesktop ? "bg-muted/80" : "scale-110 -translate-y-0.5"
                  )
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={(e) => {
              if (pathname.startsWith("/search")) {
                e.preventDefault();
                scrollToTop();
              } else {
                setIsLoadingInsights(true);
              }
            }}
          >
            <div className={cn(isDesktop ? "mr-3" : "")}>
              {isLoadingInsights ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Search size={24} strokeWidth={2.5} />
              )}
            </div>
            <span className={cn(
              "font-medium",
              isDesktop 
                ? "text-sm" 
                : "text-[10px] mt-1",
              (!isDesktop && !isActiveRoute("/search")) || isActiveRoute("/search") ? "hidden" : ""
            )}>
              Search
            </span>
          </Link>

          <Link
            to="/profile/$username" params={{ username: userUsername || "" }}
            preload="intent"
            data-testid="nav-profile"
            className={cn(
              "relative transition-all duration-200",
              isDesktop
                ? "flex items-center p-3 rounded-lg hover:bg-muted/50"
                : "flex flex-col justify-center items-center p-2",
              isActiveRoute("/profile")
                ? cn(
                    activeThemeClass,
                    isDesktop ? "bg-muted/80" : "scale-110 -translate-y-0.5"
                  )
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={(e) => {
              if (pathname.startsWith("/profile")) {
                e.preventDefault();
                scrollToTop();
              } else {
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
              (!isDesktop && !isActiveRoute("/profile")) || isActiveRoute("/profile") ? "hidden" : ""
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
