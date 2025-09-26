/* eslint-disable react-refresh/only-export-components */

import { useApiWithAuth } from "@/api";
import { useLogError } from "@/hooks/useLogError";
import { useSession } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { toast } from "react-hot-toast";
import {
  getUserFullDataByUserNameOrId,
} from "./service";
import { UsersContext } from "./types";

// Custom hooks for components to use
export const useUsers = (
  data: Array<
    { username: string; id?: string } | { username?: string; id: string }
  >
) => {
  const { isSignedIn } = useSession();
  const { handleQueryError } = useLogError();
  const api = useApiWithAuth();
  const identifier = data
    .map((d) => d.username || d.id)
    .sort()
    .join(",");

  const queryKey = ["users", identifier];

  const query = useQuery({
    queryKey,
    queryFn: () => getUserFullDataByUserNameOrId(api, data),
    enabled: isSignedIn && identifier.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Handle errors manually
  if (query.error) {
    const customErrorMessage = `Failed to get users ${queryKey.join(",")}`;
    handleQueryError(query.error, customErrorMessage);
    toast.error(customErrorMessage);
  }

  return query;
};

export const useUser = (
  data: { username: string; id?: string } | { username?: string; id: string }
) => {
  const { handleQueryError } = useLogError();
  const identifier = data?.username || data.id;
  const { isSignedIn } = useSession();
  const api = useApiWithAuth();

  const query = useQuery({
    queryKey: ["user", identifier],
    queryFn: async () => {
      return await getUserFullDataByUserNameOrId(api, [data]);
    },
    enabled: isSignedIn && !!identifier,
    staleTime: 1000 * 60 * 5,
  });

  if (query.error) {
    const customErrorMessage = `Failed to get user ${identifier}`;
    handleQueryError(query.error, customErrorMessage);
    toast.error(customErrorMessage);
  }

  return query;
};

export const useCurrentUser = () => {
  const context = useContext(UsersContext);
  if (context === undefined) {
    throw new Error("useCurrentUser must be used within a UsersProvider");
  }
  return context;
};

// Re-exports
export { UsersProvider } from './provider';
  
