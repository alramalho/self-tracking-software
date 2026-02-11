import { YearWrapped } from "@/components/YearWrapped";
import { computeFriendScore, type FriendScore } from "@/components/wrapped/FriendsLeaderboardStory";
import { useApiWithAuth } from "@/api";
import { useActivities } from "@/contexts/activities/useActivities";
import { useMetrics } from "@/contexts/metrics";
import { useCurrentUser } from "@/contexts/users";
import { getUserFullDataByUserNameOrId } from "@/contexts/users/service";
import { usePlans } from "@/contexts/plans";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/wrapped")({
  component: WrappedPage,
});

function WrappedPage() {
  const navigate = useNavigate();
  const { currentUser, isLoadingCurrentUser } = useCurrentUser();
  const { entries: metricEntries, isLoadingEntries: isLoadingMetrics } = useMetrics();
  const { activities, activityEntries, isLoadingActivities } = useActivities();
  const { plans, isLoadingPlans } = usePlans();

  const api = useApiWithAuth();

  // Get accepted friends list
  const friends = useMemo(() => {
    if (!currentUser) return [];
    return [
      ...(currentUser.connectionsFrom
        ?.filter((conn) => conn.status === "ACCEPTED")
        ?.map((conn) => conn.to) || []),
      ...(currentUser.connectionsTo
        ?.filter((conn) => conn.status === "ACCEPTED")
        ?.map((conn) => conn.from) || []),
    ];
  }, [currentUser?.connectionsFrom, currentUser?.connectionsTo]);

  // Fetch full data for each friend in parallel
  const friendIds = useMemo(() => friends.map((f) => f.id).sort().join(","), [friends]);
  const { data: friendScores = [] } = useQuery({
    queryKey: ["wrapped-friend-scores", friendIds],
    queryFn: async () => {
      const results = await Promise.all(
        friends.map((f) =>
          getUserFullDataByUserNameOrId(api, [{ id: f.id }]).catch(() => null)
        )
      );
      return results
        .filter(Boolean)
        .map((friend: any) => {
          const { totalPoints, bestStreak } = computeFriendScore(
            friend.activityEntries || [],
            friend.plans || [],
          );
          return {
            username: friend.username || "",
            name: friend.name,
            picture: friend.picture,
            totalPoints,
            bestStreak,
          };
        }) as FriendScore[];
    },
    enabled: friends.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const isLoading = isLoadingCurrentUser || isLoadingMetrics || isLoadingActivities || isLoadingPlans;

  // Default to 2025, could make this dynamic
  const year = 2025;

  const handleClose = () => {
    navigate({ to: "/" });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (!currentUser) {
    navigate({ to: "/signin", search: { redirect_url: "/wrapped" } });
    return null;
  }

  // Transform plans to match expected format
  const plansWithProgress = plans?.map((plan) => ({
    id: plan.id,
    emoji: plan.emoji,
    goal: plan.goal,
    progress: plan.progress,
    activities: plan.activities || [],
  })) || [];

  return (
    <YearWrapped
      year={year}
      metricEntries={metricEntries || []}
      activityEntries={activityEntries || []}
      activities={activities || []}
      plans={plansWithProgress}
      user={{
        username: currentUser.username,
        name: currentUser.name,
        picture: currentUser.picture,
        planType: currentUser.planType,
      }}
      friendScores={friendScores}
      onClose={handleClose}
    />
  );
}
