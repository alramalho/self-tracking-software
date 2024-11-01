"use client";

import React, { useState } from 'react';
import UserSearch, { UserSearchResult } from '@/components/UserSearch';
import { useRouter } from 'next/navigation';
import TimelineRenderer from "@/components/TimelineRenderer";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Search } from 'lucide-react';
import Notifications from '@/components/Notifications';

const FeedPage = () => {
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleUserClick = (user: UserSearchResult) => {
    router.push(`/profile/${user.username}`);
    setIsSearchOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Feed</h1>
        <button 
          onClick={() => setIsSearchOpen(true)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
        >
          <Search size={24} />
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Notifications</h2>
        <Notifications />
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Feed</h2>
        <TimelineRenderer />
      </div>

      {isSearchOpen && (
        <AppleLikePopover onClose={() => setIsSearchOpen(false)}>
          <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Search Users</h2>
            <UserSearch onUserClick={handleUserClick} />
          </div>
        </AppleLikePopover>
      )}
    </div>
  );
};

export default FeedPage;
