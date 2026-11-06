import AppleLikePopover from "@/components/AppleLikePopover";
import DeleteAccountDialog from "@/components/DeleteAccountDialog";
import { IntegrationsSettings } from "@/components/profile/IntegrationsSettings";
import { AppleHealthIntegrationCard } from "@/health/apple/AppleHealthIntegrationCard";
import { GarminIntegrationCard } from "@/health/garmin/GarminIntegrationCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { useCurrentUser } from "@/contexts/users";
import { askAiConsent, useApiWithAuth } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { aiAllowed } from "@/components/ai-consent/AiConsentDialog";
import type { AiConsentFields } from "@/components/ai-consent/types";
import { useNotifications } from "@/hooks/useNotifications";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { capitalize } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  LifeBuoy,
  Wrench,
  CreditCard,
  GraduationCap,
  KeyRound,
  Loader2,
  LogOut,
  MoveRight,
  Paintbrush,
  Pencil,
  ShieldCheck,
  Smile,
  SquareArrowUp,
  Trash2,
  Sparkles,
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
import { SettingsGroup, SettingsRow } from "./SettingsGroup";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/theme/useTheme";
import {
  EditAgePopup,
  EditFullNamePopup,
  EditLookingForApPopup,
  EditProfilePicturePopup,
} from "./EditFieldPopups";
import ThemeModeSwitcher from "./ThemeModeSwitcher";
import ReactionEmojiDrawer from "../ReactionEmojiDrawer";
import { useNavigate } from "@tanstack/react-router";
import { useDemoAchievement } from "@/contexts/demo-achievement/useDemoAchievement";
import { Capacitor } from "@capacitor/core";
import { normalizeReactionEmojis } from "@tsw/prisma/reactions";

interface ProfileSettingsPopoverProps {
  open: boolean;
  onClose: () => void;
  initialActiveView?: ActiveView | null;
  redirectTo?: string | null;
}

const isNativeIOS =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

// Define possible views including sub-views
export type ActiveView =
  | "main"
  | "userSummary"
  | "editProfile"
  | "appearance"
  | "privacy"
  | "integrations"
  | "appleHealth"
  | "garmin"
  | "admin";

// Define view depths for animation direction
const viewLevels: Record<ActiveView, number> = {
  main: 0,
  userSummary: 1,
  editProfile: 2,
  appearance: 1,
  privacy: 1,
  integrations: 1,
  appleHealth: 2,
  garmin: 2,
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

  const { userPlanType } = usePaidPlan();
  const { signOut } = useAuth();
  const { currentUser, updateUser, deleteAccount, isDeletingAccount, isAdmin } = useCurrentUser();
  const posthog = usePostHog();
  const { setShowUpgradePopover } = useUpgrade();
  const { themeMode } = useTheme();
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
  const [showReactionEmojiDrawer, setShowReactionEmojiDrawer] = useState(false);

  const navigate = useNavigate();
  const { setDemoAchievementType } = useDemoAchievement();
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const [triggeringNotification, setTriggeringNotification] = useState<
    string | null
  >(null);

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
                      Account
                    </h2>

                    <div className="space-y-4">
                      {!isNativeIOS && (
                        <SettingsGroup>
                          {userPlanType !== "FREE" ? (
                            <SettingsRow
                              icon={CreditCard}
                              title="Manage my subscription"
                              chevron
                              onClick={() =>
                                window.open(
                                  "https://billing.stripe.com/p/login/eVa03Q46z6Ivchi8ww",
                                  "_blank"
                                )
                              }
                            />
                          ) : (
                            <SettingsRow
                              icon={SquareArrowUp}
                              title="Upgrade"
                              chevron
                              onClick={() => setShowUpgradePopover(true)}
                            />
                          )}
                        </SettingsGroup>
                      )}
                      <SettingsGroup>
                        <SettingsRow
                          icon={Smile}
                          title="Reaction emojis"
                          value={normalizeReactionEmojis(currentUser?.reactionEmojis).join(" ")}
                          chevron
                          onClick={() => {
                            onClose();
                            setShowReactionEmojiDrawer(true);
                          }}
                        />
                      </SettingsGroup>
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
              case "appearance":
                return (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("main")}
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft size={18} /> Back to Settings
                    </Button>
                    <h2 className="text-lg font-semibold mb-6">Appearance</h2>
                    <div className="flex flex-col gap-6">
                      <ThemeModeSwitcher />
                      <ColorPalettePickerPopup />
                    </div>
                  </div>
                );
              case "privacy":
                return (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("main")}
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft size={18} /> Back to Settings
                    </Button>
                    <h2 className="text-lg font-semibold mb-6">Privacy & safety</h2>
                    <div className="flex flex-col gap-6">
                      <SettingsGroup footer="Coach, plan setup, voice logs and dictation send your data to AI providers.">
                        <SettingsRow
                          icon={Sparkles}
                          title="AI features"
                          trailing={
                            <Switch
                              aria-label="AI features"
                              checked={aiAllowed(currentUser as AiConsentFields | undefined)}
                              onCheckedChange={async (on) => {
                                // Turning on shows what is shared and with whom first.
                                if (on) return askAiConsent();
                                await api.put("/users/ai-consent", { granted: false });
                                await queryClient.refetchQueries({ queryKey: ["current-user"] });
                              }}
                            />
                          }
                        />
                      </SettingsGroup>
                      <SettingsGroup>
                        <SettingsRow
                          icon={ShieldCheck}
                          title="Privacy policy"
                          chevron
                          onClick={() => window.open("https://tracking.so/privacy", "_blank")}
                        />
                        <SettingsRow
                          icon={FileText}
                          title="Terms of use"
                          chevron
                          onClick={() => window.open("https://tracking.so/terms", "_blank")}
                        />
                      </SettingsGroup>
                    </div>
                  </div>
                );
              case "integrations":
                return (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("main")}
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft size={18} /> Back to Settings
                    </Button>
                    <IntegrationsSettings
                      onOpenAppleHealth={() => navigateTo("appleHealth")}
                      onOpenGarmin={() => navigateTo("garmin")}
                    />
                  </div>
                );
              case "appleHealth":
                return (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("integrations")}
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft size={18} /> Back to Integrations
                    </Button>
                    <AppleHealthIntegrationCard />
                  </div>
                );
              case "garmin":
                return (
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => navigateTo("integrations")}
                      className="mb-4 px-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft size={18} /> Back to Integrations
                    </Button>
                    <GarminIntegrationCard />
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

                      <div
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                        onClick={async () => {
                          if (currentUser?.planType === "FREE") {
                            toast.error("Coach setup only appears for Plus users");
                            return;
                          }

                          await updateUser({
                            updates: {
                              coachOnboardingCompletedAt: null,
                              proactiveCoachingEnabled: true,
                            },
                            muteNotifications: true,
                          });
                          toast.success("Coach setup will show on home");
                          onClose();
                          navigate({ to: "/" });
                        }}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Show Coach Setup
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Reset coach onboarding and open the setup flow on
                            home
                          </p>
                        </div>
                        <ShieldCheck size={20} className="text-muted-foreground" />
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

                      {/* Coach Notifications */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground px-3">
                          Coach Notifications
                        </p>
                        <div
                          className={twMerge(
                            "flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                            triggeringNotification === "week_recap" &&
                              "opacity-70 pointer-events-none"
                          )}
                          onClick={async () => {
                            setTriggeringNotification("week_recap");
                            try {
                              await api.post("/ai/coach/trigger-notification", {
                                type: "week_recap",
                              });
                              toast.success("Week recap sent to coach chat");
                            } catch (error) {
                              toast.error("Failed to trigger week recap");
                              console.error(error);
                            } finally {
                              setTriggeringNotification(null);
                            }
                          }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Trigger Week Recap
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Generate a 7-day activity recap in coach chat
                            </p>
                          </div>
                          {triggeringNotification === "week_recap" ? (
                            <Loader2
                              size={20}
                              className="text-muted-foreground animate-spin"
                            />
                          ) : (
                            <span className="text-2xl">📊</span>
                          )}
                        </div>
                        <div
                          className={twMerge(
                            "flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                            triggeringNotification === "pre_activity" &&
                              "opacity-70 pointer-events-none"
                          )}
                          onClick={async () => {
                            setTriggeringNotification("pre_activity");
                            try {
                              await api.post("/ai/coach/trigger-notification", {
                                type: "pre_activity",
                              });
                              toast.success(
                                "Pre-activity message sent to coach chat"
                              );
                            } catch (error) {
                              toast.error(
                                "Failed to trigger pre-activity message"
                              );
                              console.error(error);
                            } finally {
                              setTriggeringNotification(null);
                            }
                          }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Trigger Pre-Activity
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Generate today's activity rundown in coach chat
                            </p>
                          </div>
                          {triggeringNotification === "pre_activity" ? (
                            <Loader2
                              size={20}
                              className="text-muted-foreground animate-spin"
                            />
                          ) : (
                            <span className="text-2xl">💪</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground px-3 mt-3">
                          Jobs
                        </p>
                        <div
                          className={twMerge(
                            "flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                            triggeringNotification === "coach_assessment" &&
                              "opacity-70 pointer-events-none"
                          )}
                          onClick={async () => {
                            setTriggeringNotification("coach_assessment");
                            try {
                              const response = await api.post("/admin/run-coach-assessment-job", {
                                force: true,
                                filter_usernames: [currentUser?.username],
                              });
                              const data = response.data as { messages_sent: number; users_checked: number };
                              toast.success(`Coach assessed ${data.users_checked} user(s), sent ${data.messages_sent} message(s)`);
                            } catch (error) {
                              toast.error("Failed to run coach assessment");
                              console.error(error);
                            } finally {
                              setTriggeringNotification(null);
                            }
                          }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Run Coach Assessment
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Trigger autonomous coach check-in for your user
                            </p>
                          </div>
                          {triggeringNotification === "coach_assessment" ? (
                            <Loader2
                              size={20}
                              className="text-muted-foreground animate-spin"
                            />
                          ) : (
                            <span className="text-2xl">🤖</span>
                          )}
                        </div>
                        <div
                          className={twMerge(
                            "flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                            triggeringNotification === "plan_categorization" &&
                              "opacity-70 pointer-events-none"
                          )}
                          onClick={async () => {
                            setTriggeringNotification("plan_categorization");
                            try {
                              const response = await api.post("/plans/run-categorization");
                              const data = response.data as { categorized: number; errors: number };
                              toast.success(`Categorized ${data.categorized} plans${data.errors > 0 ? ` (${data.errors} errors)` : ""}`);
                            } catch (error) {
                              toast.error("Failed to run plan categorization");
                              console.error(error);
                            } finally {
                              setTriggeringNotification(null);
                            }
                          }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Run Plan Categorization
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Categorize all uncategorized plans
                            </p>
                          </div>
                          {triggeringNotification === "plan_categorization" ? (
                            <Loader2
                              size={20}
                              className="text-muted-foreground animate-spin"
                            />
                          ) : (
                            <span className="text-2xl">🏷️</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              case "main":
              default:
                return (
                  <>
                    <h1 className="text-2xl font-bold mb-5">Settings</h1>
                    <div className="flex flex-col gap-6">
                      <button
                        type="button"
                        aria-label="Account"
                        onClick={() => navigateTo("userSummary")}
                        className="flex w-full items-center gap-3.5 rounded-[20px] bg-card p-4 text-left active:opacity-65"
                      >
                        <Avatar className="h-[52px] w-[52px]">
                          <AvatarImage src={currentUser?.picture || undefined} />
                          <AvatarFallback>
                            {(currentUser?.name || currentUser?.username || "?")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-semibold">
                            {currentUser?.name || currentUser?.username || "Your account"}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {[
                              currentUser?.username && `@${currentUser.username}`,
                              `${capitalize((userPlanType || "FREE").toLowerCase())} plan`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <ChevronRight size={18} className="text-muted-foreground" />
                      </button>

                      <SettingsGroup title="Coach">
                        <SettingsRow
                          icon={GraduationCap}
                          title="Coach profile"
                          chevron
                          onClick={() => {
                            onClose();
                            navigate({ to: "/create-coach-profile" });
                          }}
                        />
                        <SettingsRow
                          icon={Bell}
                          title="Notifications"
                          trailing={
                            <Switch
                              aria-label="Notifications"
                              checked={isPushGranted}
                              onCheckedChange={handleNotificationChange}
                            />
                          }
                        />
                      </SettingsGroup>

                      <SettingsGroup title="App">
                        <SettingsRow
                          icon={Paintbrush}
                          title="Appearance"
                          value={[themeMode, currentUser?.themeBaseColor]
                            .filter(Boolean)
                            .map((v) => capitalize(String(v).toLowerCase()))
                            .join(" · ")}
                          chevron
                          onClick={() => navigateTo("appearance")}
                        />
                        <SettingsRow
                          icon={KeyRound}
                          title="Integrations"
                          chevron
                          onClick={() => navigateTo("integrations")}
                        />
                      </SettingsGroup>

                      <SettingsGroup>
                        <SettingsRow
                          icon={ShieldCheck}
                          title="Privacy & safety"
                          chevron
                          onClick={() => navigateTo("privacy")}
                        />
                        <SettingsRow
                          icon={LifeBuoy}
                          title="Get help"
                          chevron
                          onClick={() => window.open("mailto:alex@tracking.so")}
                        />
                        {isAdmin && (
                          <SettingsRow
                            icon={Wrench}
                            title="Admin"
                            chevron
                            onClick={() => navigateTo("admin")}
                          />
                        )}
                      </SettingsGroup>

                      <SettingsGroup>
                        <SettingsRow
                          icon={LogOut}
                          title="Log out"
                          destructive
                          onClick={() => setShowLogoutConfirm(true)}
                        />
                      </SettingsGroup>
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

      <ReactionEmojiDrawer
        open={showReactionEmojiDrawer}
        onOpenChange={setShowReactionEmojiDrawer}
      />

      <ConfirmDialogOrPopover
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Log out?"
        description="Log out of this account?"
        confirmText="Log out"
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
