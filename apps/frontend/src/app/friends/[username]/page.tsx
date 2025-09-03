"use client";

import AppleLikePopover from "@/components/AppleLikePopover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import UserSearch, { UserSearchResult } from "@/components/UserSearch";
import { useCurrentUser } from "@/contexts/users";
import { ChevronLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const FriendsPage: React.FC<{ params: { username: string } }> = ({
  params,
}) => {
  const { currentUser, isLoadingCurrentUser } = useCurrentUser();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const router = useRouter();

  const isOwnProfile =
    params.username === currentUser?.username;

  const handleUserClick = (user: UserSearchResult) => {
    setIsSearchOpen(false);
    router.push(`/profile/${user.username}`);
  };


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
      {currentUser?.friends?.length && currentUser?.friends?.length > 0 ? (
        <ul className="space-y-4">
          {currentUser?.friends?.map((friend) => (
            <li key={friend.username} className="border-b pb-4">
              <Link
                href={`/profile/${friend.username}`}
                className="flex items-center space-x-4 hover:bg-gray-50 p-2 rounded-lg"
              >
                <Avatar>
                  <AvatarImage src={friend.picture || ""} alt={friend.name || ""} />
                  <AvatarFallback>{(friend.name || "U")?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{friend.name}</p>
                  <p className="text-sm text-gray-500">@{friend.username}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : isLoadingCurrentUser ? (
        <ul className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={`skeleton-${index}`} className="border-b pb-4">
              <div className="flex items-center space-x-4 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </li>
          ))}
        </ul>
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
