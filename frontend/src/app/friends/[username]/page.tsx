"use client";

import React, { useEffect, useState } from "react";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useApiWithAuth } from "@/api";
import { Loader2 } from "lucide-react";

const FriendsPage: React.FC<{ params: { username: string } }> = ({ params }) => {
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery(params.username || "me");
  const userData = userDataQuery.data;
  const [friends, setFriends] = useState<{picture: string, name: string, username: string}[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const api = useApiWithAuth();

  const fetchFriends = async () => {
    const response = await api.get(`/friends/${params.username}`);
    return response.data.friends;
  }

  useEffect(() => {
      setFriendsLoading(true);
      if (userData && userData?.user_friends) {
        setFriends(userData?.user_friends || []); 
        setFriendsLoading(false);
      } else {
        fetchFriends().then(friends => {
          setFriends(friends);
          userDataQuery.refetch();
          setFriendsLoading(false);
        });
      }
  }, [userData]);

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
