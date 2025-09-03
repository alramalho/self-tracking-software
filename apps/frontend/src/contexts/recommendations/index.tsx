"use client";
import { useApiWithAuth } from "@/api";
import { useSession } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { Plan, Recommendation, User } from "@tsw/prisma";
import React, { createContext, ReactNode, useContext } from "react";

export interface RecommendedUsersResponse {
  recommendations: Recommendation[];
  users: Partial<User>[];
  plans: Plan[];
}

interface RecommendationsContextType {
  recommendations: Recommendation[];
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

  const recommendationsQuery = useQuery<RecommendedUsersResponse>({
    queryKey: ["recommendations"],
    queryFn: async () => {
      const response = await api.get(`/users/recommended-users`);
      return response.data;
    },
    enabled: isSignedIn && isLoaded,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  return (
    <RecommendationsContext.Provider
      value={{
        recommendations: recommendationsQuery.data?.recommendations || [],
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
