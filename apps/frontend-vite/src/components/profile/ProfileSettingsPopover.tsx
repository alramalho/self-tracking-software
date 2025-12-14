import AppleLikePopover from "@/components/AppleLikePopover";
import DeleteAccountDialog from "@/components/DeleteAccountDialog";
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
  GraduationCap,
  LogOut,
  Moon,
  MoveRight,
  Paintbrush,
  Pencil,
  ShieldCheck,
  SquareArrowUp,
  Trash2,
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
import ThemeModeSwitcher from "./ThemeModeSwitcher";
import { useNavigate } from "@tanstack/react-router";
import { useDemoAchievement } from "@/contexts/demo-achievement/useDemoAchievement";

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
  | "editProfile"
  | "color"
  | "themeMode"
  | "admin";

// Define view depths for animation direction
const viewLevels: Record<ActiveView, number> = {
  main: 0,
  userSummary: 1,
  editProfile: 2,
  color: 1,
  themeMode: 1,
  admin: 1,
};

const ProfileSettingsPopover: React.FC<ProfileSettingsPopoverProps> = ({
  open,
  onClose,
  initialActiveView = null,
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  // Single state for view navigation
  const [activeView, setActiveView] = useState<ActiveView>(
    (initialActiveView as ActiveView) || "main"
  );
  const previousViewRef = useRef<ActiveView>("main");

  const { isUserFree, userPlanType } = usePaidPlan();
  const { signOut } = useAuth();
  const { currentUser, updateUser, deleteAccount, isDeletingAccount, isAdmin } = useCurrentUser();
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

  const navigate = useNavigate();
  const { setDemoAchievementType } = useDemoAchievement();

  const handleLogout = () => {
    signOut();
    posthog.reset();
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      posthog.reset();
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
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
      <AnimatePresence initial={false} mode="wait" custom={direction}>
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
          className="w-full"
        >
          {(() => {
            switch (activeView) {
              case "userSummary":
                return (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("main")}
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft size={18} /> Back to Settings
                    </Button>
                    <h2 className="text-lg font-semibold mb-6">
                      User Settings
                    </h2>

                    <div className="space-y-4">
                      {/* Looking for AP */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Looking for Accountability Partner
                          </p>
                          <p
                            className={twMerge(
                              "text-xs text-muted-foreground",
                              currentUser?.lookingForAp
                                ? "text-green-600"
                                : "text-muted-foreground"
                            )}
                          >
                            {currentUser?.lookingForAp ? "Yes" : "No"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={"text-muted-foreground"}
                          onClick={() => setShowEditLookingForAp(true)}
                        >
                          <Pencil size={16} />
                        </Button>
                      </div>

                      {/* Age */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Age
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {currentUser?.age
                              ? `${currentUser.age} years old`
                              : "No age set"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setShowEditAge(true)}
                        >
                          <Pencil size={16} />
                        </Button>
                      </div>

                      {/* Full Name */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Full Name
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {currentUser?.name || "No name set"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setShowEditFullName(true)}
                        >
                          <Pencil size={16} />
                        </Button>
                      </div>

                      {/* Username (Read Only) */}
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Username
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {currentUser?.username || "No username set"}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground px-2">
                          Read only
                        </div>
                      </div>

                      {/* Email (Read Only) */}
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Email
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {currentUser?.email || "No email"}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground px-2">
                          Read only
                        </div>
                      </div>

                      {/* Profile Picture */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1 flex items-center gap-3">
                          <img
                            src={currentUser?.picture || "/default-avatar.png"}
                            alt="Profile"
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Profile Picture
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Click to update your photo
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setShowEditProfilePicture(true)}
                        >
                          <Pencil size={16} />
                        </Button>
                      </div>

                      {/* Invite Friends */}
                      <div
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                        onClick={() =>
                          shareOrCopyLink(
                            `https://app.tracking.so/join/${currentUser?.username}`
                          )
                        }
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Invite Friends
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Share your profile with friends
                          </p>
                        </div>
                        <UserPlus size={20} className="text-muted-foreground" />
                      </div>

                      {/* Delete Account */}
                      <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800 mt-6">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900 dark:text-red-100">
                            Delete Account
                          </p>
                          <p className="text-xs text-red-600 dark:text-red-400">
                            Permanently delete your account and all data
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900"
                          onClick={() => setShowDeleteAccountDialog(true)}
                        >
                          <Trash2 size={20} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              case "editProfile":
                return (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("userSummary")}
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
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
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft size={18} /> Back to Settings
                    </Button>
                    <ColorPalettePickerPopup
                      open={true}
                      onClose={() => navigateTo("main")}
                    />
                  </div>
                );
              case "themeMode":
                return (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("main")}
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft size={18} /> Back to Settings
                    </Button>
                    <ThemeModeSwitcher
                      open={true}
                      onClose={() => navigateTo("main")}
                    />
                  </div>
                );
              case "admin":
                return (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("main")}
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft size={18} /> Back to Settings
                    </Button>
                    <h2 className="text-lg font-semibold mb-6">
                      Admin Settings
                    </h2>

                    <div className="space-y-4">
                      {/* Redirect to Onboarding */}
                      <div
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => {
                          navigate({ to: "/onboarding" });
                        }}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Go to Onboarding
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Navigate to the onboarding flow
                          </p>
                        </div>
                        <MoveRight size={20} className="text-muted-foreground" />
                      </div>

                      {/* Demo Achievement Celebrations */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground px-3">
                          Demo Achievements
                        </p>
                        <div
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => {
                            navigate({ to: "/" });
                            setTimeout(() => setDemoAchievementType("streak"), 300);
                          }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Demo Streak Achievement
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Preview 5-week streak celebration
                            </p>
                          </div>
                          <span className="text-2xl">🔥</span>
                        </div>
                        <div
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => {
                            navigate({ to: "/" });
                            setTimeout(() => setDemoAchievementType("habit"), 300);
                          }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Demo Habit Achievement
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Preview habit formed celebration
                            </p>
                          </div>
                          <span className="text-2xl">⭐</span>
                        </div>
                        <div
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => {
                            navigate({ to: "/" });
                            setTimeout(() => setDemoAchievementType("lifestyle"), 300);
                          }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Demo Lifestyle Achievement
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Preview lifestyle milestone celebration
                            </p>
                          </div>
                          <span className="text-2xl">🏆</span>
                        </div>
                        <div
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => {
                            navigate({ to: "/" });
                            setTimeout(() => setDemoAchievementType("level_up"), 300);
                          }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Demo Level Up Achievement
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Preview level-up celebration
                            </p>
                          </div>
                          <span className="text-2xl">🎖️</span>
                        </div>
                      </div>

                      {/* Reset Level Celebration */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground px-3">
                          Level Celebration
                        </p>
                        <div
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                          onClick={async () => {
                            await updateUser({
                              updates: { celebratedLevelThreshold: 0 },
                              muteNotifications: false,
                            });
                            navigate({ to: "/" });
                          }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Reset Level Celebration
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Set celebratedLevelThreshold to 0 to re-trigger level-up popups
                            </p>
                          </div>
                          <span className="text-2xl">🔄</span>
                        </div>
                      </div>
                    </div>
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
                          isUserFree ? "text-muted-foreground" : themeVariants.text
                        )}
                      >
                        On {capitalize(userPlanType || "FREE")} Plan
                        {isUserFree && (
                          <SquareArrowUp
                            onClick={() => setShowUpgradePopover(true)}
                            size={20}
                            className="text-foreground cursor-pointer"
                          />
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {/* Push Notifications */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Push Notifications
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isPushGranted
                              ? "Notifications enabled"
                              : "Enable notifications for updates"}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Bell size={20} className="text-muted-foreground" />
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
                        onClick={() => navigateTo("userSummary")}
                      >
                        <UserPen size={28} />
                        <span>User Settings</span>
                      </Button>

                      <Button
                        variant="ghost"
                        className="w-full flex items-center justify-start px-0 gap-2"
                        onClick={() => {
                          onClose();
                          navigate({ to: "/create-coach-profile" });
                        }}
                      >
                        <GraduationCap size={28} />
                        <span>Coach Profile</span>
                      </Button>

                      <Button
                        variant="ghost"
                        className="w-full flex items-center justify-start px-0 gap-2"
                        onClick={() => navigateTo("color")}
                      >
                        <Paintbrush size={28} />
                        <span>Color Palette</span>
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full flex items-center justify-start px-0 gap-2"
                        onClick={() => navigateTo("themeMode")}
                      >
                        <Moon size={28} />
                        <span>Theme Mode</span>
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          className="w-full flex items-center justify-start px-0 gap-2"
                          onClick={() => navigateTo("admin")}
                        >
                          <ShieldCheck size={28} />
                          <span>Admin</span>
                        </Button>
                      )}
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
        <div className="max-h-[80vh] overflow-y-auto mt-12 mb-12">
          {renderContent()}
        </div>
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

      <DeleteAccountDialog
        isOpen={showDeleteAccountDialog}
        onClose={() => setShowDeleteAccountDialog(false)}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeletingAccount}
      />
    </>
  );
};

export default ProfileSettingsPopover;
