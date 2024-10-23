"use client";

import React, { useEffect } from "react";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";

const FriendRequestsPage: React.FC = () => {
  const { userData, fetchUserData } = useUserPlan();
  const currentUser = userData["me"]?.user;
  const friendRequests = userData["me"]?.friendRequests.filter(
    (request) => request.status === "pending" && request.recipient_id === currentUser?.id
  );
  const api = useApiWithAuth();

  const handleFriendRequest = async (requestId: string, action: "accept" | "reject") => {
    try {
      await api.post(`/friend-requests/${requestId}/${action}`);
      toast.success(`Friend request ${action}ed`);
      fetchUserData();
    } catch (error) {
      console.error(`Error ${action}ing friend request:`, error);
      toast.error(`Failed to ${action} friend request`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Friend Requests</h1>
      {friendRequests && friendRequests.length > 0 ? (
        <ul className="space-y-4">
          {friendRequests.map((request) => (
            <li key={request.id} className="flex items-center justify-between border-b pb-4">
              <Link href={`/profile/${request.sender_username}`} className="flex items-center space-x-4">
                <Avatar>
                  <AvatarImage src={request.sender_picture} alt={request.sender_name || ""} />
                  <AvatarFallback>{(request.sender_name || "U")[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{request.sender_name}</p>
                  <p className="text-sm text-gray-500">@{request.sender_username}</p>
                </div>
              </Link>
              <div className="space-x-2">
                <Button onClick={() => handleFriendRequest(request.id, "accept")} variant="default">
                  Accept
                </Button>
                <Button onClick={() => handleFriendRequest(request.id, "reject")} variant="outline">
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-gray-500">No pending friend requests.</p>
      )}
    </div>
  );
};

export default FriendRequestsPage;
