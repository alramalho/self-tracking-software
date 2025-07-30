"use client";

import * as React from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { useApiWithAuth } from "@/api";
import { useUserPlan, VisibilityType } from "@/contexts/UserPlanContext";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useUpgrade } from "@/contexts/UpgradeContext";
const visibilityOptions = [
  {
    value: "public",
    label: "Public",
  },
  {
    value: "friends",
    label: "Only friends",
  },
  {
    value: "private",
    label: "Only me",
  },
] as const;

export default function ActivityPrivacySettings({
  onClose,
}: {
  onClose: () => void;
}) {
  const api = useApiWithAuth();
  const { useCurrentUserDataQuery } = useUserPlan();
  const currendUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currendUserDataQuery;
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState<VisibilityType>(
    (userData?.user?.defaultActivityVisibility as VisibilityType) || "public"
  );
  const hasChanges =
    selectedValue !== userData?.user?.defaultActivityVisibility;
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();

  const handleSave = async () => {
    try {
      setIsLoading(true);
      await api.post("/users/update-user", {
        defaultActivityVisibility: selectedValue,
      });
      currendUserDataQuery.refetch();
      toast.success("Privacy settings updated");
      onClose();
    } catch (error) {
      toast.error("Failed to update privacy settings");
    } finally {
      setIsLoading(false);
    }
  };

  // Update selected value when user data changes
  React.useEffect(() => {
    if (userData?.user?.defaultActivityVisibility) {
      setSelectedValue(
        userData.user.defaultActivityVisibility as VisibilityType
      );
    }
  }, [userData?.user?.defaultActivityVisibility]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Activity Privacy Settings</h2>
        <p className="text-sm text-gray-500">
          Choose your default activity visibility
        </p>
      </div>

      <RadioGroup.Root
        className="space-y-2"
        value={selectedValue}
        onValueChange={(value: string) => {
          const isOptionLocked =
            userPaidPlanType === "free" &&
            (value === "friends" || value === "private");
          if (!isOptionLocked) {
            setSelectedValue(value as VisibilityType);
          }
        }}
        disabled={isLoading}
      >
        {visibilityOptions.map((option) => {
          const radioId = `radio-${option.value}`;
          const isLocked =
            userPaidPlanType === "free" &&
            (option.value === "friends" || option.value === "private");
          return (
            <label
              key={option.value}
              htmlFor={radioId}
              className={cn(
                "flex items-center justify-between space-x-2 rounded-lg border p-4",
                "transition-colors",
                isLoading || isLocked
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer",
                selectedValue === option.value &&
                  `${variants.border} ${variants.card.selected.bg}`
              )}
            >
              <div className="flex-1">
                <div className="font-medium">{option.label}</div>
                {isLocked && (
                  <div className="text-sm text-gray-500">
                    Available for supporters only
                  </div>
                )}
              </div>
              <RadioGroup.Item
                value={option.value}
                id={radioId}
                className="hidden"
                disabled={isLocked}
              >
                <RadioGroup.Indicator />
              </RadioGroup.Item>
              {selectedValue === option.value ? (
                <div
                  className={cn(
                    "h-6 w-6 flex items-center justify-center",
                    "text-primary transition-opacity",
                    `${variants.text}`
                  )}
                >
                  <Check className="h-5 w-5" />
                </div>
              ) : isLocked ? (
                <div className="h-6 w-6 flex items-center justify-center text-gray-400">
                  <Lock className="h-5 w-5" />
                </div>
              ) : null}
            </label>
          );
        })}
      </RadioGroup.Root>
      {userPaidPlanType === "free" ? (
        <div className="text-sm text-gray-500">
          Private and friends-only options are only available to supporters.{" "}
          <span
            onClick={() => setShowUpgradePopover(true)}
            className="underline"
          >
            Upgrade your plan
          </span>{" "}
          to access these features.
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          You can also set this up individually in the respective{" "}
          <Link href="/add" className="underline">
            activity settings
          </Link>
          .
        </div>
      )}
      <div className="flex justify-end pt-4">
        <Button
          disabled={!hasChanges || isLoading}
          onClick={handleSave}
          loading={isLoading}
          className={`${isMobile ? "w-full" : ""}`}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
