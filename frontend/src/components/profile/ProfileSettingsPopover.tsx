import React, { useState } from "react";
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

interface ProfileSettingsPopoverProps {
  open: boolean;
  onClose: () => void;
}

// Define possible views
type ActiveView = "main" | "user" | "privacy" | "ai" | "color";

const ProfileSettingsPopover: React.FC<ProfileSettingsPopoverProps> = ({
  open,
  onClose,
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Single state for view navigation
  const [activeView, setActiveView] = useState<ActiveView>("main");

  const { userPaidPlanType } = usePaidPlan();
  const { signOut } = useClerk();
  const posthog = usePostHog();
  const { setShowUpgradePopover } = useUpgrade();
  const themeColors = useThemeColors();
  const themeVariants = getThemeVariants(themeColors.raw);

  const handleLogout = () => {
    signOut();
    posthog.reset();
  };

  // Reset view when popover closes
  React.useEffect(() => {
    if (!open) {
      // Add a small delay to allow closing animation before reset
      const timer = setTimeout(() => {
        setActiveView("main");
      }, 300); // Adjust timing if needed
      return () => clearTimeout(timer);
    }
  }, [open]);


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

    // Determine animation direction (simple approach: assume going deeper is 'forward')
    // A more robust approach might track previous state
    const direction = activeView === "main" ? -1 : 1;

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
          transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
          className="w-full" // Ensure the motion div takes full width
        >
          {(() => {
              switch (activeView) {
                case "user":
                  return (
                    <div>
                      <Button
                        variant="ghost"
                        onClick={() => setActiveView("main")}
                        className="mb-4 px-0 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                      >
                        <ChevronLeft size={18} /> Back to Settings
                      </Button>
                      <UserProfile routing={"hash"} />
                    </div>
                  );
                // case "privacy":
                //   return (
                //     <div>
                //       <Button
                //         variant="ghost"
                //         onClick={() => setActiveView("main")}
                //         className="mb-4 px-0 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                //       >
                //         <ChevronLeft size={18} /> Back to Settings
                //       </Button>
                //       <PrivacySettings onClose={() => setActiveView("main")} />
                //     </div>
                //   );
                // case "ai":
                //   return (
                //     <div>
                //       <Button
                //         variant="ghost"
                //         onClick={() => setActiveView("main")}
                //         className="mb-4 px-0 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                //       >
                //         <ChevronLeft size={18} /> Back to Settings
                //       </Button>
                //       <AISettings />
                //     </div>
                //   );
                case "color":
                  return (
                    <div>
                      <Button
                        variant="ghost"
                        onClick={() => setActiveView("main")}
                        className="mb-4 px-0 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                      >
                        <ChevronLeft size={18} /> Back to Settings
                      </Button>
                      <ColorPalettePickerPopup
                        open={true} // Keep it open when this view is active
                        onClose={() => setActiveView("main")} // Use 'onClose' to navigate back
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
                            userPaidPlanType === "free" ? "text-gray-500" : themeVariants.text
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
                          onClick={() => setActiveView("user")} // Update onClick
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
                          onClick={() => setActiveView("color")} // Update onClick
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
