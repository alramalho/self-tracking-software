"use client";

import React, { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import { useApiWithAuth } from '@/api';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from 'next/link';

const SearchPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [searchResults, setSearchResults] = useState<{ user_id: string; username: string; name: string; picture: string }[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const api = useApiWithAuth();

  useEffect(() => {
    const searchUser = async () => {
      if (debouncedSearchTerm) {
        setIsLoading(true);
        try {
          const { data } = await api.get(`/api/search-users/${debouncedSearchTerm}`);
          setSearchResults(data);
          console.log({data});
        } catch (error) {
          console.error('Error searching for user:', error);
          setSearchResults(null);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSearchResults(null);
      }
    };

    searchUser();
  }, [debouncedSearchTerm]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Search Users</h1>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Enter username"
        className="w-full p-2 border border-gray-300 rounded-md mb-4"
      />
      {isLoading && <p className="text-center">Searching...</p>}
      {!isLoading && searchTerm && !searchResults && (
        <p className="text-center text-sm text-gray-500">
          No user &apos;{searchTerm}&apos; found
        </p>
      )}
      {searchResults != null && searchResults.map((result) => (
        <Link key={result.user_id} href={`/profile/${result.username}`} className="block">
          <div className="flex items-center space-x-4 hover:bg-gray-100 p-2 rounded-md transition-colors border-b border-gray-200">
            <Avatar>
              <AvatarImage src={result.picture || '/default-avatar.png'} alt={result.name || result.username} />
              <AvatarFallback>{result.name ? result.name[0] : "U"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{result.name}</p>
              <p className="text-sm text-gray-600">@{result.username}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default SearchPage;
