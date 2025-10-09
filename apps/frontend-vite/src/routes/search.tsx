import { useApiWithAuth } from "@/api";
import AppleLikePopover from "@/components/AppleLikePopover";
import { CollapsibleSelfUserCard } from "@/components/CollapsibleSelfUserCard";
import { RecommendedUsers } from "@/components/RecommendedUsers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import UserSearch, { type UserSearchResult } from "@/components/UserSearch";
import { usePlans } from "@/contexts/plans";
import { useRecommendations } from "@/contexts/recommendations";
import { useCurrentUser } from "@/contexts/users";
import { useNotifications } from "@/hooks/useNotifications";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { isAfter } from "date-fns";
import { Bell, ChevronDown, RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import PullToRefresh from "react-simple-pull-to-refresh";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

function SearchPage() {
  const { isPushGranted, requestPermission } = useNotifications();
  const navigate = useNavigate();
  const api = useApiWithAuth();
  const { isLoadingCurrentUser } = useCurrentUser();
  const { plans, isLoadingPlans } = usePlans();
  const { refetchRecommendations } = useRecommendations();

  const activePlans = useMemo(
    () =>
      plans?.filter(
        (plan) =>
          plan.deletedAt === null &&
          (plan.finishingDate === null ||
            isAfter(plan.finishingDate, new Date()))
      ) || [],
    [plans]
  );

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    activePlans.length > 0 ? activePlans[0].id : null
  );
  const [isRecomputingForPlan, setIsRecomputingForPlan] = useState(false);

  // Update selected plan when active plans load
  if (activePlans.length > 0 && !selectedPlanId) {
    setSelectedPlanId(activePlans[0].id);
  }

  function refreshRecommendations() {
    api.post("/users/compute-recommendations", {
      planId: selectedPlanId,
    });
    refetchRecommendations();
    toast.success("Recommendations refreshed!");
  }

  const handleUserClick = (user: UserSearchResult) => {
    navigate({ to: `/profile/${user.username}` });
  };

  const handlePlanChange = async (planId: string) => {
    setSelectedPlanId(planId);
    setIsRecomputingForPlan(true);
    try {
      await api.post("/users/compute-recommendations", {
        planId: planId,
      });
      await refetchRecommendations();
      toast.success("Recommendations updated!");
    } catch (error) {
      toast.error("Failed to update recommendations");
    } finally {
      setIsRecomputingForPlan(false);
    }
  };

  if (!isPushGranted) {
    return (
      <AppleLikePopover
        open={true}
        onClose={() => {
          navigate({ to: "/" });
        }}
      >
        <div className="flex flex-col items-center justify-center py-8">
          <div className="bg-gray-100 p-4 rounded-full mb-4">
            <Bell size={48} className="text-gray-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-700 text-center">
            Please enable notifications to continue
          </h2>
          {!isPushGranted && (
            <p className="text-gray-500 text-sm">
              <button className="underline" onClick={requestPermission}>
                Click here
              </button>{" "}
              to be notified of new notifications.
            </p>
          )}
          {isPushGranted && (
            <p className="text-gray-500 text-sm text-center">
              This will enable you to stay on top of newest recommended partners
              and received friend requests.
            </p>
          )}
          <Button className="mt-4" onClick={requestPermission}>
            <Bell className="mr-2 h-4 w-4" />
            Enable Notifications
          </Button>
        </div>
      </AppleLikePopover>
    );
  }

  return (
    <>
      <PullToRefresh
        onRefresh={async () => {
          refreshRecommendations();
        }}
        pullingContent={
          <div className="flex items-center justify-center my-4">
            <RefreshCcw size={24} className="text-gray-500" />
          </div>
        }
        refreshingContent={
          <div className="flex items-center justify-center my-4">
            <RefreshCcw size={24} className="text-gray-500 animate-spin" />
          </div>
        }
        className="!h-fit"
      >
        <div className="container mx-auto py-4 px-4 max-w-3xl space-y-6">
          {/* Search Section */}
          <UserSearch onUserClick={handleUserClick} />

          {/* Plan Selector */}
          {!isLoadingCurrentUser &&
            !isLoadingPlans &&
            activePlans.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 font-medium">
                  Find partners for:
                </span>
                <div className="relative flex-1">
                  <select
                    value={selectedPlanId || ""}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    disabled={isRecomputingForPlan}
                    className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {activePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.emoji} {plan.goal}
                      </option>
                    ))}
                  </select>
                  {isRecomputingForPlan ? (
                    <RefreshCcw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 animate-spin" />
                  ) : (
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                  )}
                </div>
              </div>
            )}

          {/* Recommendations Section */}
          {isLoadingCurrentUser || isLoadingPlans ? (
            <div className="space-y-6 mt-4">
              <div>
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="grid grid-cols-1 justify-items-center">
                  <Skeleton className="h-48 w-full max-w-sm rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-48 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <CollapsibleSelfUserCard />
            </div>
          )}
        </div>
      </PullToRefresh>
      {!isLoadingCurrentUser && !isLoadingPlans && (
        <div className="mt-4 p-4">
          {isRecomputingForPlan ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-48 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <RecommendedUsers selectedPlanId={selectedPlanId} />
          )}
        </div>
      )}
    </>
  );
}
