'use client';

import React from 'react';
import { UserPlanProvider, useUserPlan } from '@/contexts/UserPlanContext';
import { Loader2 } from 'lucide-react';

export const UserPlanProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {loading} = useUserPlan();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2">Loading your data...</p>
      </div>
    );
  }

  return <>{children}</>;
};