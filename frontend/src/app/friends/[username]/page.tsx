"use client";

import React, { useEffect, useState } from "react";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useApiWithAuth } from "@/api";
import { useQuery } from "@tanstack/react-query";

const FriendsPage: React.FC<{ params: { username: string } }> = ({ params }) => {
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery(params.username || "me");
  const userData = userDataQuery.data;
  const api = useApiWithAuth();

  const friendsQuery = useQuery<{picture: string, name: string, username: string}[]>({
    queryKey: ['friends', params.username],
    queryFn: async () => {
      if (userData?.user_friends) {
        return userData.user_friends;
      }
      const response = await api.get(`/friends/${params.username}`);
      userDataQuery.refetch();
      return response.data.friends;
    },
    enabled: !!params.username
  });

  const friends = friendsQuery.data || [];
  const friendsLoading = friendsQuery.isLoading;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Friends</h1>
      {friends.length > 0 ? (
        <ul className="space-y-4">
          {friends.map((friend) => (
            <li key={friend.username} className="border-b pb-4">
              <Link href={`/profile/${friend.username}`} className="flex items-center space-x-4 hover:bg-gray-50 p-2 rounded-lg">
                <Avatar>
                  <AvatarImage src={friend.picture} alt={friend.name || ""} />
                  <AvatarFallback>{(friend.name || "U")[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{friend.name}</p>
                  <p className="text-sm text-gray-500">@{friend.username}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        (friendsLoading || userDataQuery.isLoading) ? (
          <p className="text-center text-gray-500">Loading friends...</p>
        ) : (
          <p className="text-center text-gray-500">You don&apos;t have any friends yet.</p>
        )
      )}
    </div>
  );
};

export default FriendsPage;
