"use client";

import React, { useEffect, useState } from "react";
import { User, useUserPlan } from "@/contexts/UserPlanContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useApiWithAuth } from "@/api";
import { useQuery } from "@tanstack/react-query";
import AppleLikePopover from "@/components/AppleLikePopover";
import UserSearch, { UserSearchResult } from "@/components/UserSearch";
import { useRouter } from "next/navigation";
import { Search, UserPlus, ChevronLeft } from "lucide-react";

const FriendsPage: React.FC<{ params: { username: string } }> = ({
  params,
}) => {
  const { useUserDataQuery, useCurrentUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery(params.username);
  const selfUserDataQuery = useCurrentUserDataQuery();
  const userData = userDataQuery.data;
  const selfUserData = selfUserDataQuery.data;
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const api = useApiWithAuth();
  const router = useRouter();

  const isOwnProfile =
    params.username === selfUserData?.user?.username;

  const handleUserClick = (user: UserSearchResult) => {
    setIsSearchOpen(false);
    router.push(`/profile/${user.username}`);
  };

  const friendsQuery = useQuery<
    { picture: string; name: string; username: string }[]
  >({
    queryKey: ["friends", params.username],
    queryFn: async () => {
      if (userData?.user_friends) {
        return userData.user_friends;
      }
      const response = await api.get(`/friends/${params.username}`);
      userDataQuery.refetch();
      return response.data.friends;
    },
    enabled: !!params.username,
  });

  const friends = friendsQuery.data || [];
  const friendsLoading = friendsQuery.isLoading;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between relative mb-4">
        <button
          className="absolute left-0 p-2 rounded-full hover:bg-gray-100"
          onClick={() => window.history.back()}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold mx-auto">Friends</h1>
        {isOwnProfile && (
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <UserPlus size={24} />
          </button>
        )}
      </div>
      {friends.length > 0 ? (
        <ul className="space-y-4">
          {friends.map((friend) => (
            <li key={friend.username} className="border-b pb-4">
              <Link
                href={`/profile/${friend.username}`}
                className="flex items-center space-x-4 hover:bg-gray-50 p-2 rounded-lg"
              >
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
      ) : friendsLoading || userDataQuery.isLoading ? (
        <p className="text-center text-gray-500">Loading friends...</p>
      ) : (
        <p className="text-center text-gray-500">
          You don&apos;t have any friends yet.
        </p>
      )}
      <AppleLikePopover
        onClose={() => setIsSearchOpen(false)}
        open={isSearchOpen}
      >
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-4">Search Users</h2>
          <UserSearch onUserClick={handleUserClick} />
        </div>
      </AppleLikePopover>
    </div>
  );
};

export default FriendsPage;
