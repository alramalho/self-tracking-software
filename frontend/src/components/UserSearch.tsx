import React, { useState, useEffect } from 'react';
import { useApiWithAuth } from '@/api';
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { X } from "lucide-react";

export interface UserSearchResult {
  user_id: string;
  username: string;
  name: string;
  picture?: string;
}

interface UserSearchProps {
  onUserClick: (user: UserSearchResult) => void;
  selectedUsers?: UserSearchResult[];
  onUserRemove?: (userId: string) => void;
}

const UserSearch: React.FC<UserSearchProps> = ({ onUserClick, selectedUsers = [], onUserRemove }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const api = useApiWithAuth();

  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.trim() === "") {
        setSearchResults([]);
        return;
      }

      try {
        const response = await api.get(`/search-users/${searchTerm}`);
        setSearchResults(response.data);
      } catch (error) {
        console.error("Error searching users:", error);
      }
    };

    const debounce = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchTerm]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {selectedUsers.map((user) => (
          <Avatar
            key={user.user_id}
            className="cursor-pointer relative"
            onClick={() => onUserRemove && onUserRemove(user.user_id)}
          >
            <AvatarImage
              src={user.picture || "/default-avatar.png"}
              alt={user.name || user.username}
            />
            <AvatarFallback>
              {user.name ? user.name[0] : user.username[0]}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <Input
        type="text"
        placeholder="Search users..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <ul className="mt-2">
        {searchResults.map((user) => (
          <li
            key={user.user_id}
            className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
            onClick={() => onUserClick(user)}
          >
            <Avatar className="mr-2">
              <AvatarImage
                src={user.picture || "/default-avatar.png"}
                alt={user.name || user.username}
              />
              <AvatarFallback>
                {user.name ? user.name[0] : user.username[0]}
              </AvatarFallback>
            </Avatar>
            <span>{user.name || user.username}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserSearch;
