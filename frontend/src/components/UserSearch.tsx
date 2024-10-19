import React, { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import { useApiWithAuth } from '@/api';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export interface UserSearchResult {
  user_id: string;
  username: string;
  name: string;
  picture: string;
}

interface UserSearchProps {
  onUserClick: (user: UserSearchResult) => void;
}

const UserSearch: React.FC<UserSearchProps> = ({ onUserClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [searchResult, setSearchResult] = useState<UserSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const api = useApiWithAuth();

  useEffect(() => {
    const searchUser = async () => {
      if (debouncedSearchTerm) {
        setIsLoading(true);
        try {
          const { data } = await api.get(`/api/search-users/${debouncedSearchTerm}`);
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
    <div>
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
        <div 
          className="flex items-center space-x-4 hover:bg-gray-100 p-2 rounded-md transition-colors cursor-pointer"
          onClick={() => onUserClick(searchResult)}
        >
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

export default UserSearch;
