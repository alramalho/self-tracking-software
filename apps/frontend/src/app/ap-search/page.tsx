"use client";

import AppleLikePopover from "@/components/AppleLikePopover";
import { ApSearchComponent } from "@/components/ApSearch";
import { Button } from "@/components/ui/button";
import UserSearch, { UserSearchResult } from "@/components/UserSearch";
import { useNotifications } from "@/hooks/useNotifications";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

const ApSearchPage: React.FC = () => {
  const { isPushGranted, requestPermission } = useNotifications();
  const router = useRouter();

  const handleUserClick = (user: UserSearchResult) => {
    router.push(`/profile/${user.username}`);
  };

  if (!isPushGranted) {
    return (
      <AppleLikePopover
        open={true}
        onClose={() => {
          router.push("/");
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
    <div className="container mx-auto py-4 px-4 max-w-3xl space-y-6">
      {/* Search Section */}

      <UserSearch onUserClick={handleUserClick} />

      {/* Recommendations Section */}
      <ApSearchComponent />
    </div>
  );
};

export default ApSearchPage;
