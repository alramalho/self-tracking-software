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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { twMerge } from "tailwind-merge";
import { capitalize } from "lodash";
import AppleLikePopover from "@/components/AppleLikePopover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AISettings from "@/components/AISettings";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import ColorPalettePickerPopup from "./ColorPalettePickerPopup";
import { usePostHog } from "posthog-js/react";
import ConfirmDialog from "../ConfirmDialog";
import { useUpgrade } from "@/contexts/UpgradeContext";
import UserSettingsPopover from "./UserSettingsPopover";

interface ProfileSettingsPopoverProps {
  open: boolean;
  onClose: () => void;
}

const ProfileSettingsPopover: React.FC<ProfileSettingsPopoverProps> = ({
  open,
  onClose,
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);

  const { userPaidPlanType } = usePaidPlan();
  const userHasAccessToAi = userPaidPlanType === "supporter";
  const { signOut } = useClerk();
  const posthog = usePostHog();
  const { setShowUpgradePopover } = useUpgrade();

  const handleLogout = () => {
    signOut();
    posthog.reset();
  };

  return (
    <>
      <AppleLikePopover open={open} onClose={onClose}>
        <div className="max-h-[80vh] overflow-y-auto mt-12 mb-12">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Settings</h1>
            <span
              className={twMerge(
                "text-xl font-cursive flex items-center gap-2",
                userPaidPlanType === "free"
                  ? "text-gray-500"
                  : userPaidPlanType === "plus"
                  ? "text-blue-500"
                  : "text-indigo-500"
              )}
            >
              On {capitalize(userPaidPlanType || "free")} Plan
              <SquareArrowUp
                onClick={() => setShowUpgradePopover(true)}
                size={20}
                className="text-gray-800"
              />
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-start px-0 gap-2"
              onClick={() => setShowUserSettings(true)}
            >
              <User size={28} />
              <span>User Settings</span>
            </Button>
            
            {/* <Button
              variant="ghost"
              className="w-full flex items-center justify-start px-0 gap-2"
              onClick={() => setShowAISettings(true)}
            >
              <Brain size={28} />
              <span>AI Settings</span>
            </Button> */}
            <Button
              variant="ghost"
              className="w-full flex items-center justify-start px-0 gap-2"
              onClick={() => setShowColorPalette(true)}
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
        </div>

        <ColorPalettePickerPopup
          open={showColorPalette}
          onClose={() => setShowColorPalette(false)}
        />

        <AppleLikePopover
          open={showUserSettings}
          onClose={() => setShowUserSettings(false)}
        >
          <UserProfile routing={"hash"} />
        </AppleLikePopover>

        <AppleLikePopover
          open={showAISettings}
          onClose={() => setShowAISettings(false)}
        >
          <AISettings />
        </AppleLikePopover>
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
