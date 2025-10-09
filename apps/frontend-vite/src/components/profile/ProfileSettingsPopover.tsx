import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { useCurrentUser } from "@/contexts/users";
import { useNotifications } from "@/hooks/useNotifications";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { useThemeColors } from "@/hooks/useThemeColors";
import { capitalize } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronLeft,
  CreditCard,
  LogOut,
  Paintbrush,
  Pencil,
  Share2,
  SquareArrowUp,
  UserPen,
  UserPlus,
} from "lucide-react";
import { usePostHog } from "posthog-js/react";
import React, { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { twMerge } from "tailwind-merge";
import ConfirmDialogOrPopover from "../ConfirmDialogOrPopover";
import { Switch } from "../ui/switch";
import { TextAreaWithVoice } from "../ui/text-area-with-voice";
import ColorPalettePickerPopup from "./ColorPalettePickerPopup";
import {
  EditAgePopup,
  EditFullNamePopup,
  EditLookingForApPopup,
  EditProfilePicturePopup,
} from "./EditFieldPopups";

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
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Single state for view navigation
  const [activeView, setActiveView] = useState<ActiveView>(
    (initialActiveView as ActiveView) || "main"
  );
  const previousViewRef = useRef<ActiveView>("main");

  const { isUserFree, userPlanType } = usePaidPlan();
  const { signOut } = useAuth();
  const { currentUser, updateUser } = useCurrentUser();
  const posthog = usePostHog();
  const { setShowUpgradePopover } = useUpgrade();
  const themeColors = useThemeColors();
  const themeVariants = getThemeVariants(themeColors.raw);
  const { isPushGranted, setIsPushGranted, requestPermission } =
    useNotifications();
  const { shareOrCopyLink } = useShareOrCopy();
  const [temporaryProfileDescription, setTemporaryProfileDescription] =
    useState(currentUser?.profile || "");

  // Edit popup states
  const [showEditLookingForAp, setShowEditLookingForAp] = useState(false);
  const [showEditAge, setShowEditAge] = useState(false);
  const [showEditFullName, setShowEditFullName] = useState(false);
  const [showEditProfilePicture, setShowEditProfilePicture] = useState(false);

  const handleLogout = () => {
    signOut();
    posthog.reset();
  };

  const handleNotificationChange = async (checked: boolean) => {
    if (checked) {
      if (!isPushGranted) {
        try {
          await requestPermission();
          toast.success("Permission for push notifications was granted");
        } catch (error) {
          toast.error("Failed to request permission for push notifications");
          console.error(
            "Failed to request permission for push notifications:",
            error
          );
        }
      } else {
        toast.success("Push notifications already enabled");
      }
    } else {
      setIsPushGranted(false);
      toast.success("Push notifications disabled");
    }
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
              case "userSummary":
                return (
                  <div>
                    {/* Back button goes to main settings */}
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("main")}
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <ChevronLeft size={18} /> Back to Settings
                    </Button>
                    <h2 className="text-lg font-semibold mb-6">
                      User Settings
                    </h2>

                    <div className="space-y-4">
                      {/* Looking for AP */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Looking for Accountability Partner
                          </p>
                          <p
                            className={twMerge(
                              "text-xs text-gray-500",
                              currentUser?.lookingForAp
                                ? "text-green-600"
                                : "text-gray-500"
                            )}
                          >
                            {currentUser?.lookingForAp ? "Yes" : "No"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={"text-gray-500"}
                          onClick={() => setShowEditLookingForAp(true)}
                        >
                          <Pencil size={16} />
                        </Button>
                      </div>

                      {/* Age */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Age
                          </p>
                          <p className="text-xs text-gray-500">
                            {currentUser?.age
                              ? `${currentUser.age} years old`
                              : "No age set"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => setShowEditAge(true)}
                        >
                          <Pencil size={16} />
                        </Button>
                      </div>

                      {/* Full Name */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Full Name
                          </p>
                          <p className="text-xs text-gray-500">
                            {currentUser?.name || "No name set"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => setShowEditFullName(true)}
                        >
                          <Pencil size={16} />
                        </Button>
                      </div>

                      {/* Username (Read Only) */}
                      <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Username
                          </p>
                          <p className="text-xs text-gray-500">
                            {currentUser?.username || "No username set"}
                          </p>
                        </div>
                        <div className="text-xs text-gray-400 px-2">
                          Read only
                        </div>
                      </div>

                      {/* Email (Read Only) */}
                      <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Email
                          </p>
                          <p className="text-xs text-gray-500">
                            {currentUser?.email || "No email"}
                          </p>
                        </div>
                        <div className="text-xs text-gray-400 px-2">
                          Read only
                        </div>
                      </div>

                      {/* Profile Picture */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 flex items-center gap-3">
                          <img
                            src={currentUser?.picture || "/default-avatar.png"}
                            alt="Profile"
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Profile Picture
                            </p>
                            <p className="text-xs text-gray-500">
                              Click to update your photo
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() => setShowEditProfilePicture(true)}
                        >
                          <Pencil size={16} />
                        </Button>
                      </div>

                      {/* Invite Friends */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Invite Friends
                          </p>
                          <p className="text-xs text-gray-500">
                            Share your profile with friends
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() =>
                            shareOrCopyLink(
                              `https://app.tracking.so/join/${currentUser?.username}`
                            )
                          }
                        >
                          <UserPlus size={20} />
                        </Button>
                      </div>

                      {/* Share Profile Link */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Share Profile Link
                          </p>
                          <p className="text-xs text-gray-500">
                            Copy link to share your profile
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-500 hover:text-gray-700"
                          onClick={() =>
                            shareOrCopyLink(
                              `https://app.tracking.so/profile/${currentUser?.username}`
                            )
                          }
                        >
                          <Share2 size={20} />
                        </Button>
                      </div>
                    </div>
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
                    <p>
                      You may use this space to talk about who you are, as this
                      will be showed to other users in the discovery tab and
                      used in the matchmaking algorithm.
                    </p>
                    <div className="p-2">
                      <TextAreaWithVoice
                        value={temporaryProfileDescription}
                        onChange={(value) => {
                          setTemporaryProfileDescription(value);
                        }}
                        placeholder="A lively and outgoing "
                      />
                    </div>
                    {temporaryProfileDescription && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          await updateUser({
                            updates: {
                              profile: temporaryProfileDescription,
                            },
                          });
                          navigateTo("userSummary");
                        }}
                      >
                        Save
                      </Button>
                    )}
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
                          isUserFree ? "text-gray-500" : themeVariants.text
                        )}
                      >
                        On {capitalize(userPlanType || "FREE")} Plan
                        {isUserFree && (
                          <SquareArrowUp
                            onClick={() => setShowUpgradePopover(true)}
                            size={20}
                            className="text-gray-800 cursor-pointer"
                          />
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {/* Push Notifications */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Push Notifications
                          </p>
                          <p className="text-xs text-gray-500">
                            {isPushGranted
                              ? "Notifications enabled"
                              : "Enable notifications for updates"}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Bell size={20} className="text-gray-500" />
                          <Switch
                            checked={isPushGranted}
                            onCheckedChange={handleNotificationChange}
                          />
                        </div>
                      </div>
                      {userPlanType !== "FREE" && (
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

                      <Button
                        variant="ghost"
                        className="w-full flex items-center justify-start px-0 gap-2"
                        onClick={() => navigateTo("userSummary")} // Navigate to userSummary
                      >
                        <UserPen size={28} />
                        <span>User Settings</span>
                      </Button>

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

      <ConfirmDialogOrPopover
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        description="Are you sure you want to log out?"
        confirmText="Logout"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Edit Field Popups */}
      <EditLookingForApPopup
        open={showEditLookingForAp}
        onClose={() => setShowEditLookingForAp(false)}
        currentValue={currentUser?.lookingForAp || false}
      />

      <EditAgePopup
        open={showEditAge}
        onClose={() => setShowEditAge(false)}
        currentValue={currentUser?.age || null}
      />

      <EditFullNamePopup
        open={showEditFullName}
        onClose={() => setShowEditFullName(false)}
      />

      <EditProfilePicturePopup
        open={showEditProfilePicture}
        onClose={() => setShowEditProfilePicture(false)}
      />
    </>
  );
};

export default ProfileSettingsPopover;
