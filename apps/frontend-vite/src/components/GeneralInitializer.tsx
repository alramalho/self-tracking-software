import { useAuth } from "@/contexts/auth";
import { useCurrentUser } from "@/contexts/users";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotifications } from "@/hooks/useNotifications";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { useLocation, useNavigate } from "@tanstack/react-router";
import posthog from "posthog-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import Lottie from "react-lottie";
import targetAnimation from "../../public/animations/target.lottie.json";
import BottomNav from "./BottomNav";
import FeedbackForm from "./FeedbackForm";
import { BarProgressLoader } from "./ui/bar-progress-loader";

export default function GeneralInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded: isClerkLoaded } = useAuth();
  const { currentUser, hasLoadedUserData, updateUser } = useCurrentUser();
  const { isAppInstalled, isPushGranted } = useNotifications();
  const [hasRanPosthogIdentify, setHasRanPosthogIdentify] = useState(false);
  const [showBugDialog, setShowBugDialog] = useState(false);
  const location = useLocation();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const navigate = useNavigate();
  const [hasUpdatedTimezone, setHasUpdatedTimezone] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Convert hex to rgba for the gradient
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const email = currentUser?.email || "";
  const pathname = location.pathname;
  const isOnboardingPage = pathname.startsWith("/onboarding");
  const isDownloadPage = pathname.startsWith("/download");
  const isAiPage = pathname.startsWith("/ai");
  const isDmsPage = pathname.startsWith("/dms");
  const friends = useMemo(() => {
    return [
      ...(currentUser?.connectionsFrom
        .filter((conn) => conn.status === "ACCEPTED")
        ?.map((conn) => conn.to) || []),
      ...(currentUser?.connectionsTo
        .filter((conn) => conn.status === "ACCEPTED")
        ?.map((conn) => conn.from) || []),
    ];
  }, [currentUser?.connectionsFrom, currentUser?.connectionsTo]);

  useEffect(() => {
    if (
      isClerkLoaded &&
      isSignedIn &&
      hasLoadedUserData &&
      currentUser?.onboardingCompletedAt == null &&
      !isOnboardingPage
    ) {
      navigate({ to: "/onboarding" });
    }
  }, [
    currentUser,
    navigate,
    isClerkLoaded,
    isSignedIn,
    hasLoadedUserData,
    pathname,
    isOnboardingPage,
  ]);

  useEffect(() => {
    if (
      isClerkLoaded &&
      !isSignedIn &&
      !pathname.startsWith("/signin") &&
      !pathname.startsWith("/signup") &&
      !pathname.startsWith("/download")
    ) {
      navigate({ to: "/signin", search: { redirect_url: pathname } });
    }
  }, [isClerkLoaded, isSignedIn, pathname, navigate]);

  useEffect(() => {
    if (isSignedIn && hasLoadedUserData && currentUser) {
      if (!hasRanPosthogIdentify) {
        posthog.identify(currentUser.id, {
          email: currentUser.email,
          name: currentUser.name,
          username: currentUser.username,
          is_app_installed: isAppInstalled,
          is_looking_for_ap: currentUser.lookingForAp,
          friend_count: friends?.length,
          is_push_granted: isPushGranted,
        });
        setHasRanPosthogIdentify(true);
      }
      if (
        !hasUpdatedTimezone &&
        currentUser.timezone !==
          Intl.DateTimeFormat().resolvedOptions().timeZone
      ) {
        setHasUpdatedTimezone(true);
        updateUser({
          updates: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          muteNotifications: true,
        }).catch((err) => {
          console.error("Failed to update timezone on initial load:", err);
        });
      }
    }
  }, [
    isSignedIn,
    hasLoadedUserData,
    currentUser,
    hasRanPosthogIdentify,
    isAppInstalled,
    hasUpdatedTimezone,
    isPushGranted,
    updateUser,
    friends,
  ]);

  // Scroll to top on route change
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo(0, 0);
      }
    });
  }, [pathname]);

  const reportBug = async (text: string, email: string) => {
    await toast.promise(
      fetch("/api/report-bug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, text }),
      }),
      {
        loading: "Sending bug report...",
        success: "Bug report sent successfully!",
        error: "Failed to send bug report",
      }
    );
  };

  if (
    !isClerkLoaded ||
    (isSignedIn && !hasLoadedUserData) ||
    (isSignedIn &&
      hasLoadedUserData &&
      currentUser?.onboardingCompletedAt == null &&
      !isOnboardingPage)
  ) {
    return (
      <>
        {showBugDialog && (
          <FeedbackForm
            title="🐞 Report a Bug"
            email={email}
            placeholder="Please describe the bug you encountered..."
            onSubmit={(text) => reportBug(text, email)}
            onClose={() => setShowBugDialog(false)}
            isEmailEditable={true}
          />
        )}
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-8">
          <Lottie
            options={{
              loop: true,
              autoplay: true,
              animationData: targetAnimation,
              rendererSettings: {
                preserveAspectRatio: "xMidYMid slice",
              },
            }}
            height={130}
            width={130}
          />
          <BarProgressLoader durationSeconds={20} />
        </div>
      </>
    );
  }

  const isProfilePage = pathname.startsWith("/profile");
  const isHomePage = pathname == "/";
  const showsBottomNav = isSignedIn && !isDownloadPage && !isAiPage && !isDmsPage;
  return (
    <>
      {isOnboardingPage ? (
        children
      ) : (
        <>
          <div
            id="main-scroll-container"
            ref={scrollContainerRef}
            className={cn(
              "absolute inset-0 overflow-auto",
              showsBottomNav && !isDesktop ? "pb-[5.9rem]" : "",
              showsBottomNav && isDesktop ? "left-0" : ""
            )}
          >
            {isProfilePage || isHomePage ? (
              <div
                className="absolute top-0 left-0 w-full h-screen pointer-events-none z-0"
                style={{
                  background: `radial-gradient(ellipse 800px 800px at 60% 5%, ${hexToRgba(
                    variants.brightHex,
                    0.3
                  )} 0%, ${hexToRgba(
                    variants.brightHex,
                    0.05
                  )} 40%, transparent 100%)`,
                }}
              />
            ) : (
              <>
                <div
                  className={cn(
                    "fixed top-0 left-0 w-full h-screen z-[-1]",
                    // "[background-image:linear-gradient(#f0f0f0_1px,transparent_1px),linear-gradient(to_right,#f0f0f0_1px,#f5f5f5_1px)] [background-size:20px_20px] flex flex-col items-center justify-center p-4"
                  )}
                />
              </>
            )}

            {children}
          </div>
          {showsBottomNav && <BottomNav />}
        </>
      )}
    </>
  );
}
