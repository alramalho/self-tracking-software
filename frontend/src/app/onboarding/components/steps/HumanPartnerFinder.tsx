"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  PersonStanding,
  Search,
  Send,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import AppleLikePopover from "@/components/AppleLikePopover";
import { ProfileSetupDynamicUI } from "@/components/ProfileSetupDynamicUI";
import { ApSearchComponent } from "@/components/ApSearch";
import { FriendRequest, User, useUserPlan } from "@/contexts/UserPlanContext";
import { useApiWithAuth } from "@/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { withFadeUpAnimation } from "../../lib";

const OptionCard = ({
  isSelected,
  onClick,
  icon,
  title,
  description,
}: {
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) => {
  return (
    <div
      onClick={onClick}
      className={`w-full p-5 rounded-xl border-2 transition-all duration-200 text-left ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            isSelected ? "bg-blue-100" : "bg-gray-100"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3
            className={`text-md font-semibold ${
              isSelected ? "text-blue-900" : "text-gray-900"
            }`}
          >
            {title}
          </h3>
          <p
            className={`text-xs mt-1 ${
              isSelected ? "text-blue-700" : "text-gray-600"
            }`}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

const FriendRequestCard = ({
  request,
  user,
  type,
  onAccept,
  onReject,
}: {
  request: FriendRequest;
  user: User | null;
  type: "sent" | "received";
  onAccept?: () => void;
  onReject?: () => void;
}) => {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
      <Avatar className="w-10 h-10">
        <AvatarImage src={user?.picture} alt={user?.name} />
        <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {user?.name || "Unknown User"}
        </p>
        <p className="text-xs text-gray-500 truncate">
          @{user?.username || "unknown"}
        </p>

        {request.message && (
          <p className="text-xs text-gray-400 truncate mt-2">&quot;{request.message}&quot;</p>
        )}
      </div>

      {type === "sent" && (
        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          Sent
        </div>
      )}

      {type === "received" && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
            onClick={onAccept}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={onReject}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

const HumanPartnerFinder = () => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const currentUserQuery = useCurrentUserDataQuery();
  const hasProfile = userData?.user?.profile !== undefined;
  const { shareOrCopyReferralLink } = useShareOrCopy();
  const [profileSetupPopupOpen, setProfileSetupPopoverOpen] = useState(false);
  const [apSearchPopupOpen, setApSearchPopupOpen] = useState(false);
  const api = useApiWithAuth();

  const currentUserReceivedFriendRequests =
    currentUserQuery.data?.receivedFriendRequests;
  const currentUserSentFriendRequests =
    currentUserQuery.data?.sentFriendRequests;

  const pendingSentFriendRequests =
    currentUserSentFriendRequests?.filter(
      (request) => request.status === "pending"
    ) || [];

  const pendingReceivedFriendRequests =
    currentUserReceivedFriendRequests?.filter(
      (request) => request.status === "pending"
    ) || [];

  // Get all user IDs from friend requests
  const allUserIds = [
    ...pendingSentFriendRequests.map((req) => req.recipient_id),
    ...pendingReceivedFriendRequests.map((req) => req.sender_id),
  ];

  // Load user data for friend requests
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["friendRequestUsers", allUserIds],
    queryFn: async () => {
      console.log("allUserIds", allUserIds);
      if (allUserIds.length === 0) return {};

      const userPromises = allUserIds.map((userId) =>
        api.get(`/user/${userId}`).then((response) => response.data)
      );

      const users = await Promise.all(userPromises);
      const results: { [key: string]: User } = {};

      users.forEach((user: User) => {
        if (user) {
          results[user.id] = user;
        }
      });

      return results;
    },
    enabled: allUserIds.length > 0,
  });

  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      await toast.promise(api.post(`/accept-friend-request/${requestId}`), {
        loading: "Accepting friend request...",
        success: "Friend request accepted!",
        error: "Failed to accept friend request",
      });
      currentUserQuery.refetch();
    } catch (error) {
      console.error("Error accepting friend request:", error);
    }
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    try {
      await toast.promise(api.post(`/reject-friend-request/${requestId}`), {
        loading: "Rejecting friend request...",
        success: "Friend request rejected",
        error: "Failed to reject friend request",
      });
      currentUserQuery.refetch();
    } catch (error) {
      console.error("Error rejecting friend request:", error);
    }
  };

  return (
    <>
      <div className="w-full max-w-lg space-y-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <PersonStanding className="w-20 h-20 text-blue-600" />
            <h2 className="text-2xl mt-2 font-bold tracking-tight text-gray-900">
              Let&apos;s find you a human partner
            </h2>
          </div>
          <p className="text-md text-gray-600">
            How would you like to connect with others?
          </p>
        </div>

        <OptionCard
          isSelected={true}
          onClick={shareOrCopyReferralLink}
          icon={<Send className="w-6 h-6" />}
          title="Invite a friend"
          description="Send your personal link to your friends, family and colleagues"
        />
        <OptionCard
          isSelected={false}
          onClick={() => {
            if (hasProfile) {
              setApSearchPopupOpen(true);
            } else {
              setProfileSetupPopoverOpen(true);
            }
          }}
          icon={<Search className="w-6 h-6" />}
          title="Find one in our community"
          description="Browse through the pool of people of similar age & goals."
        />

        {/* Friend Requests Section */}
        {pendingReceivedFriendRequests.length === 0 &&
          pendingSentFriendRequests.length === 0 &&
          !isLoadingUsers && (
            <p className="text-md text-gray-600 text-center">
              Friend requests will appear here.
            </p>
          )}

        {/* Loading State */}
        {isLoadingUsers &&
          (pendingReceivedFriendRequests.length > 0 ||
            pendingSentFriendRequests.length > 0) && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 font-medium">
                Friend Requests
              </p>
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-500">
                  Loading friend requests...
                </span>
              </div>
            </div>
          )}

        {/* Friend Requests Content */}
        {!isLoadingUsers &&
          (pendingReceivedFriendRequests.length > 0 ||
            pendingSentFriendRequests.length > 0) && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 font-medium">
                Friend Requests
              </p>

              {/* Received Friend Requests */}
              {pendingReceivedFriendRequests.map((request) => {
                const user = usersData?.[request.sender_id] || null;
                return (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    user={user}
                    type="received"
                    onAccept={() => handleAcceptFriendRequest(request.id)}
                    onReject={() => handleRejectFriendRequest(request.id)}
                  />
                );
              })}

              {/* Sent Friend Requests */}
              {pendingSentFriendRequests.map((request) => {
                const user = usersData?.[request.recipient_id] || null;
                return (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    user={user}
                    type="sent"
                  />
                );
              })}
            </div>
          )}
      </div>

      <AppleLikePopover
        open={profileSetupPopupOpen}
        onClose={() => {
          setProfileSetupPopoverOpen(false);
        }}
      >
        <ProfileSetupDynamicUI
          submitButtonText="Save Profile"
          onSubmit={async () => {
            setProfileSetupPopoverOpen(false);
            setApSearchPopupOpen(true);
          }}
        />
      </AppleLikePopover>
      <AppleLikePopover
        open={apSearchPopupOpen}
        onClose={() => {
          setApSearchPopupOpen(false);
        }}
      >
        <ApSearchComponent />
      </AppleLikePopover>
    </>
  );
};

export default withFadeUpAnimation(HumanPartnerFinder);