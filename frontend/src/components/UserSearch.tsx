import React, { useState, useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, X } from "lucide-react";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { getThemeVariants } from "@/utils/theme";
import { useThemeColors } from "@/hooks/useThemeColors";
import Link from "next/link";

export interface UserSearchResult {
  userId: string;
  username: string;
  name: string;
  picture?: string;
}

interface UserSearchProps {
  onUserClick: (user: UserSearchResult) => void;
  selectedUsers?: UserSearchResult[];
  onUserRemove?: (userId: string) => void;
}

const UserSearch: React.FC<UserSearchProps> = ({
  onUserClick,
  selectedUsers = [],
  onUserRemove,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const api = useApiWithAuth();
  const { useCurrentUserDataQuery, refetchUserData } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const router = useRouter();

  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.trim() === "") {
        setSearchResults([]);
        return;
      }

      try {
        setIsLoading(true);
        const response = await api.get(`users/search-users/${searchTerm}`);
        setSearchResults(response.data);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setIsLoading(false);
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
            key={user.userId}
            className="cursor-pointer relative"
            onClick={() => onUserRemove && onUserRemove(user.userId)}
          >
            <AvatarImage
              src={user.picture || "/default-avatar.png"}
              alt={user.username}
            />
            <AvatarFallback>{user.name ? user.name[0] : "U"}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <div className="relative">
        <Input
          type="text"
          placeholder="🔍 Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-white"
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500 " />
          </div>
        )}
      </div>
      <ul className="mt-2">
        {searchResults.map((user) => (
          <li
            key={user.userId}
            className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
            onClick={() => onUserClick(user)}
          >
            <Avatar className="mr-2">
              <AvatarImage
                src={user.picture || "/default-avatar.png"}
                alt={user.username}
              />
              <AvatarFallback>{user.name ? user.name[0] : "U"}</AvatarFallback>
            </Avatar>
            <span>{user.username}</span>
          </li>
        ))}
      </ul>
      {/* <Button
        variant="outline"
        onClick={async () => {
          if (!userData?.lookingForAp) {
            await api.post("/users/update-user", {
              looking_for_ap: true,
            });
            currentUserDataQuery.refetch();
          }
          router.push("/looking-for-ap");
        }}
        className={`w-full mt-2 text-white transition-all duration-200 shadow-md rounded-lg font-medium ${variants.hardGradientBg}`}
      >
        Find me an Accountability Partner 🤝
      </Button> */}
    </div>
  );
};

export default UserSearch;
