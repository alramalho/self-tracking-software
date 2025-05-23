import React, { useState, useRef } from "react";
import { useClerk } from "@clerk/nextjs";
import { UserProfile } from "@clerk/nextjs";
import {
  LogOut,
  Settings,
  Paintbrush,
  SquareArrowUp,
  Brain,
  User,
  CreditCard,
  LockKeyhole,
  ChevronLeft,
  Pencil,
  CircleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { twMerge } from "tailwind-merge";
import { capitalize } from "lodash";
import AppleLikePopover from "@/components/AppleLikePopover";
import AISettings from "@/components/AISettings";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import ColorPalettePickerPopup from "./ColorPalettePickerPopup";
import { usePostHog } from "posthog-js/react";
import ConfirmDialog from "../ConfirmDialog";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import PrivacySettings from "./ActivityPrivacySettings";
import { motion, AnimatePresence } from "framer-motion";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { ProfileSetupDynamicUI } from "@/components/ProfileSetupDynamicUI";
import { Switch } from "../ui/switch";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";

interface ProfileSettingsPopoverProps {
  open: boolean;
  onClose: () => void;
  initialActiveView?: ActiveView | null;
  redirectTo?: string | null;
}

// Define possible views including sub-views
export type ActiveView =
  | "main"
  | "userSummary"
  | "userProfile"
  | "privacy"
  | "ai"
  | "color"
  | "editProfile";

// Define view depths for animation direction
const viewLevels: Record<ActiveView, number> = {
  main: 0,
  userSummary: 1,
  userProfile: 2,
  editProfile: 2,
  privacy: 1,
  ai: 1,
  color: 1,
};

const ProfileSettingsPopover: React.FC<ProfileSettingsPopoverProps> = ({
  open,
  onClose,
  initialActiveView = null,
  redirectTo = null,
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Single state for view navigation
  const [activeView, setActiveView] = useState<ActiveView>(initialActiveView as ActiveView || "main");
  const api = useApiWithAuth();
  const previousViewRef = useRef<ActiveView>("main");

  const { userPaidPlanType } = usePaidPlan();
  const { signOut } = useClerk();
  const { useCurrentUserDataQuery, refetchUserData } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: currentUserData } = currentUserDataQuery;
  const posthog = usePostHog();
  const { setShowUpgradePopover } = useUpgrade();
  const [lookingForAp, setLookingForAp] = useState(
    currentUserData?.user?.looking_for_ap || false
  );
  const themeColors = useThemeColors();
  const themeVariants = getThemeVariants(themeColors.raw);
  const router = useRouter();
  
  const handleLogout = () => {
    signOut();
    posthog.reset();
  };

  // Use initialActiveView when it changes
  React.useEffect(() => {
    if (initialActiveView && open) {
      setActiveView(initialActiveView as ActiveView);
    }
  }, [initialActiveView, open]);

  // Reset view when popover closes
  React.useEffect(() => {
    if (!open) {
      // Add a small delay to allow closing animation before reset
      const timer = setTimeout(() => {
        setActiveView("main");
        previousViewRef.current = "main"; // Reset previous view as well
      }, 300); // Adjust timing if needed
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Function to handle view changes and update previous view
  const navigateTo = (newView: ActiveView) => {
    previousViewRef.current = activeView;
    setActiveView(newView);
  };

  const renderContent = () => {
    // Define animation variants
    const variants = {
      enter: (direction: number) => ({
        x: direction > 0 ? "100%" : "-100%",
        opacity: 0,
      }),
      center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
      },
      exit: (direction: number) => ({
        zIndex: 0,
        x: direction < 0 ? "100%" : "-100%",
        opacity: 0,
      }),
    };

    // Determine animation direction based on view levels
    const currentLevel = viewLevels[activeView];
    const previousLevel = viewLevels[previousViewRef.current];
    const direction = currentLevel > previousLevel ? 1 : -1;

    return (
      // Use AnimatePresence to handle mount/unmount animations
      <AnimatePresence initial={false} mode="wait" custom={direction}>
        {/* Use activeView as key to trigger animation on change */}
        <motion.div
          key={activeView}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="w-full" // Ensure the motion div takes full width
        >
          {(() => {
            switch (activeView) {
              case "userSummary": // Renamed from "user"
                return (
                  <div>
                    {/* Back button goes to main settings */}
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("main")} // Use navigateTo
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <ChevronLeft size={18} /> Back to Settings
                    </Button>
                    <h2 className="text-lg font-semibold mb-3">
                      User Settings
                    </h2>
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex items-center gap-2 mt-1">
                        <Switch
                          checked={lookingForAp}
                          onCheckedChange={async (checked) => {
                            setLookingForAp(checked);
                            await api.post("/update-user", {
                              looking_for_ap: checked,
                            });
                            toast.success("Profile updated");
                            currentUserDataQuery.refetch();
                          }}
                        />
                        <span className="text-sm text-gray-500">
                          Looking for Accountability Partner
                          <Popover>
                            <PopoverTrigger className="inline cursor-help" onClick={(e) => e.stopPropagation()}>
                              <CircleAlert size={16} className="ml-1 inline text-gray-400" />
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 text-sm">
                              <p>This will make your profile discoverable and allow us to recommend your profile to people also looking for AP&apos;s.</p>
                            </PopoverContent>
                          </Popover>
                        </span>
                        {/* <span className="text-xs text-gray-400">
                          <CircleAlert size={16} /> This will make your profile discoverable and allow us to recommend your profile to people also looking for AP&apos;s.
                        </span> */}
                      </div>
                      <div className="relative space-y-2 p-3 border rounded-md bg-gray-50 pr-8">
                        {currentUserData?.user?.profile ? (
                          <p className="text-sm text-gray-700 italic">
                            {currentUserData.user.profile}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No profile description set.
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute bottom-1 right-0 text-gray-500 hover:text-gray-700"
                          onClick={() => navigateTo("editProfile")}
                        >
                          <Pencil size={18} />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full flex items-center justify-start px-2 gap-2 mt-4"
                        onClick={() => navigateTo("userProfile")}
                      >
                        <Settings size={20} />
                        <span>Manage my account data</span>
                      </Button>
                    </div>
                  </div>
                );
              case "userProfile": // New case for the full profile
                return (
                  <div>
                    {/* Back button goes to user summary */}
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("userSummary")} // Use navigateTo
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <ChevronLeft size={18} /> Back to User Settings
                    </Button>
                    <UserProfile routing={"hash"} />
                  </div>
                );
              case "editProfile": // New case for editing the profile
                return (
                  <div>
                    {/* Back button goes to user summary */}
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("userSummary")} // Use navigateTo
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <ChevronLeft size={18} /> Back to User Settings
                    </Button>
                    <h2 className="text-lg font-semibold mb-3">
                      Update Your Profile Description
                    </h2>
                    <ProfileSetupDynamicUI
                      submitButtonText="Save Profile"
                      onSubmit={async () => {
                        // Refetch user data after update and navigate back
                        await refetchUserData();
                        if (redirectTo) {
                          router.push(redirectTo);
                        } else {
                          navigateTo("userSummary");
                        }
                      }}
                    />
                  </div>
                );
              case "color":
                return (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("main")}
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <ChevronLeft size={18} /> Back to Settings
                    </Button>
                    <ColorPalettePickerPopup
                      open={true} // Keep it open when this view is active
                      onClose={() => navigateTo("main")} // Use navigateTo to navigate back
                    />
                  </div>
                );
              case "main":
              default:
                return (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h1 className="text-2xl font-bold">Settings</h1>
                      <span
                        className={twMerge(
                          "text-xl font-cursive flex items-center gap-2",
                          userPaidPlanType === "free"
                            ? "text-gray-500"
                            : themeVariants.text
                        )}
                      >
                        On {capitalize(userPaidPlanType || "free")} Plan
                        {userPaidPlanType === "free" && (
                          <SquareArrowUp
                            onClick={() => setShowUpgradePopover(true)}
                            size={20}
                            className="text-gray-800 cursor-pointer"
                          />
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {userPaidPlanType !== "free" && (
                        <Button
                          variant="ghost"
                          className="w-full flex items-center justify-start px-0 gap-2"
                          onClick={() => {
                            window.open(
                              "https://billing.stripe.com/p/login/eVa03Q46z6Ivchi8ww",
                              "_blank"
                            );
                          }}
                        >
                          <CreditCard size={28} />
                          <span>Manage my subscription</span>
                        </Button>
                      )}
                      {/* <Button
                          variant="ghost"
                          className="w-full flex items-center justify-start px-0 gap-2"
                          // onClick={() => setActiveView("privacy")} // Update onClick
                        >
                          <LockKeyhole size={28} />
                          <span>Activity Privacy Settings</span>
                        </Button> */}

                      <Button
                        variant="ghost"
                        className="w-full flex items-center justify-start px-0 gap-2"
                        onClick={() => navigateTo("userSummary")} // Navigate to userSummary
                      >
                        <User size={28} />
                        <span>User Settings</span>
                      </Button>

                      {/* <Button
                          variant="ghost"
                          className="w-full flex items-center justify-start px-0 gap-2"
                          // onClick={() => setActiveView("ai")} // Update onClick
                        >
                          <Brain size={28} />
                          <span>AI Settings</span>
                        </Button> */}
                      <Button
                        variant="ghost"
                        className="w-full flex items-center justify-start px-0 gap-2"
                        onClick={() => navigateTo("color")} // Navigate to color view
                      >
                        <Paintbrush size={28} />
                        <span>Color Palette</span>
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setShowLogoutConfirm(true)}
                        className="w-full flex items-center justify-start px-0 gap-2"
                      >
                        <LogOut size={28} />
                        <span>Logout</span>
                      </Button>
                    </div>
                  </>
                );
            }
          })()}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <>
      <AppleLikePopover open={open} onClose={onClose}>
        {/* Render content based on activeView */}
        <div className="max-h-[80vh] overflow-y-auto mt-12 mb-12">
          {renderContent()}
        </div>

        {/* Keep ConfirmDialog outside the main navigation flow */}
      </AppleLikePopover>
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        description="Are you sure you want to log out?"
        confirmText="Logout"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
};

export default ProfileSettingsPopover;
