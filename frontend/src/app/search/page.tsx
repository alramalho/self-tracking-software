"use client";

import React from 'react';
import UserSearch, { UserSearchResult } from '@/components/UserSearch';
import { useRouter } from 'next/navigation';

const SearchPage = () => {
  const router = useRouter();

  const handleUserClick = (user: UserSearchResult) => {
    router.push(`/profile/${user.username}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Search Users</h1>
      <UserSearch onUserClick={handleUserClick} />
    </div>
  );
};

export default SearchPage;
