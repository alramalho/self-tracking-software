"use client";

import UserCard from "@/components/UserCard";
import { useActivities } from "@/contexts/activities";
import { usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn, isActivePlan } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useState } from "react";

export const CollapsibleSelfUserCard: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { plans } = usePlans();
  const { activities, activityEntries } = useActivities();
  const [isProfileExpanded, setIsProfileExpanded] = useState(true);

  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const currentPlan = plans && plans.length > 0 ? plans?.reduce((min, plan) =>
    !min ||
    (plan.sortOrder !== null &&
      (min.sortOrder === null || plan.sortOrder < min.sortOrder))
      ? plan
      : min
  ) : null;

  if (!currentUser) {
    return null;
  }

  return (
    <div>
      <button
        onClick={() => setIsProfileExpanded(!isProfileExpanded)}
        className="flex items-center gap-2 w-full text-left mb-4 hover:opacity-70 transition-opacity"
      >
        <h2 className="text-lg font-semibold">Your profile</h2>
        {isProfileExpanded ? (
          <ChevronUp size={20} />
        ) : (
          <ChevronDown size={20} />
        )}
      </button>

      <AnimatePresence>
        {isProfileExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="pt-2"
          >
            <div className="grid grid-cols-1 justify-items-center">
              <UserCard
                user={currentUser}
                plan={{emoji: currentPlan?.emoji || undefined, goal: currentPlan?.goal || ""}}
                plans={plans?.filter((p) => isActivePlan(p)) || []}
                activities={activities || []}
                activityEntries={activityEntries || []}
                showFriendRequest={false}
                showScore={false}
                showStreaks={false}
                className={`max-w-sm ring-1 ${cn(
                  variants.ringBright,
                  variants.card.softGlassBg
                )}`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};