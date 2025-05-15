'use client';

import React from 'react';
import { UserPlanProvider } from '@/contexts/UserPlanContext';
import { OfflineActionQueueProvider } from '@/hooks/useOfflineActionQueue';

export const UserPlanProviderWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <OfflineActionQueueProvider>
      <UserPlanProvider>{children}</UserPlanProvider>
    </OfflineActionQueueProvider>
  );
};
