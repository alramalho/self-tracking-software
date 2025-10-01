import { useActivities } from "@/contexts/activities/useActivities";
import { usePlans } from "@/contexts/plans";
import { useCurrentUser, useUser } from "@/contexts/users";
import { useMemo } from "react";

export const useUnifiedProfileData = (username?: string) => {
  const { currentUser, isLoadingCurrentUser, sendFriendRequest, acceptFriendRequest, rejectFriendRequest } = useCurrentUser();
  const { activities, activityEntries, isLoadingActivities, isLoadingActivityEntries } = useActivities();
  const { plans, isLoadingPlans } = usePlans();

  // For external users, use the existing useUser hook
  // Only call useUser when we have a username and it's not the current user
  const shouldFetchExternalUser = !!username && username !== currentUser?.username;
  const { data: externalUserData, isLoading: isLoadingExternalUser } = useUser(
    shouldFetchExternalUser ? { username } : { username: "" }
  );

  const isOwnProfile = !username || username === currentUser?.username;

  // Unified profile data
  const profileData = useMemo(() => {
    if (isOwnProfile && currentUser) {
      // For current user, merge scattered data into the same structure as external users
      return {
        ...currentUser,
        plans: plans || [],
        activities: activities || [],
        activityEntries: activityEntries || [],
        // Keep existing fields from currentUser (friends, connections, etc.)
      };
    } else if (!isOwnProfile && externalUserData) {
      // For external users, data is already in the right format
      return externalUserData;
    }

    return null;
  }, [isOwnProfile, currentUser, plans, activities, activityEntries, externalUserData]);

  // Loading states
  const isLoading = useMemo(() => {
    if (isOwnProfile) {
      return isLoadingCurrentUser || isLoadingActivities || isLoadingActivityEntries || isLoadingPlans;
    } else {
      return isLoadingExternalUser;
    }
  }, [isOwnProfile, isLoadingCurrentUser, isLoadingActivities, isLoadingActivityEntries, isLoadingPlans, isLoadingExternalUser]);

  return {
    profileData,
    isLoading,
    isOwnProfile,
    // Always provide the actions, but they'll only work for own profile
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    // Provide current user separately for cases where we need to compare with profile data
    currentUser,
  };
};
