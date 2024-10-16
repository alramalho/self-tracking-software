"use client";

import React, { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import { useApiWithAuth } from '@/api';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const SearchPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [searchResult, setSearchResult] = useState<{ username: string; name: string; picture: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const api = useApiWithAuth();

  useEffect(() => {
    const searchUser = async () => {
      if (debouncedSearchTerm) {
        setIsLoading(true);
        try {
          const { data } = await api.get(`/api/search-username/${debouncedSearchTerm}`);
          setSearchResult(data);
        } catch (error) {
          console.error('Error searching for user:', error);
          setSearchResult(null);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSearchResult(null);
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
      {!isLoading && searchTerm && !searchResult && (
        <p className="text-center text-sm text-gray-500">
          No user &apos;{searchTerm}&apos; found
        </p>
      )}
      {searchResult && (
        <div className="flex items-center space-x-4">
          <Avatar>
            <AvatarImage src={searchResult.picture || '/default-avatar.png'} alt={searchResult.name || searchResult.username} />
            <AvatarFallback>{searchResult.name ? searchResult.name[0] : searchResult.username[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{searchResult.name}</p>
            <p className="text-sm text-gray-600">@{searchResult.username}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
