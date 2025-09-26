/* eslint-disable react-refresh/only-export-components */

"use client";
import { useApiWithAuth } from "@/api";
import { useLogError } from "@/hooks/useLogError";
import { useSession } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { type Plan, type Recommendation, type User } from "@tsw/prisma";
import React, { createContext, type ReactNode, useContext } from "react";

export interface RecommendedUsersResponse {
  recommendations: Recommendation[];
  users: Partial<User>[];
  plans: Plan[];
}

interface RecommendationsContextType {
  recommendations: Recommendation[];
  refetchRecommendations: () => void;
  users: Partial<User>[];
  plans: Plan[];
  isLoadingRecommendations: boolean;
}

const RecommendationsContext = createContext<
  RecommendationsContextType | undefined
>(undefined);

export const RecommendationsProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const { isSignedIn, isLoaded } = useSession();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();
  const recommendationsQuery = useQuery<RecommendedUsersResponse>({
    queryKey: ["recommendations"],
    queryFn: async () => {
      console.log("fetching recommendations")
      const response = await api.get(`/users/recommended-users`);
      return response.data;
    },
    enabled: !!isSignedIn && isLoaded,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  if (recommendationsQuery.error) {
    const customErrorMessage = `Failed to get recommendations`;
    handleQueryError(recommendationsQuery.error, customErrorMessage);
  }

  return (
    <RecommendationsContext.Provider
      value={{
        recommendations: recommendationsQuery.data?.recommendations || [],
        refetchRecommendations: recommendationsQuery.refetch,
        users: recommendationsQuery.data?.users || [],
        plans: recommendationsQuery.data?.plans || [],
        isLoadingRecommendations: recommendationsQuery.isLoading,
      }}
    >
      {children}
    </RecommendationsContext.Provider>
  );
};

export const useRecommendations = () => {
  const context = useContext(RecommendationsContext);
  if (!context) {
    throw new Error(
      "useRecommendations must be used within a RecommendationsProvider"
    );
  }
  return context;
};
