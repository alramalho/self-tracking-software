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
import { Bell, RefreshCcw } from "lucide-react";
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
  const { isLoadingPlans } = usePlans();
  const { refetchRecommendations } = useRecommendations();

  const handleUserClick = (user: UserSearchResult) => {
    navigate({ to: `/profile/${user.username}` });
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
          await api.post("/users/compute-recommendations");
          await refetchRecommendations();
          toast.success("Recommendations refreshed!");
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
          <RecommendedUsers />
        </div>
      )}
    </>
  );
}