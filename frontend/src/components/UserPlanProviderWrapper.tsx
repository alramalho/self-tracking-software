'use client';

import React from 'react';
import { UserPlanProvider} from '@/contexts/UserPlanContext';

export const UserPlanProviderWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <UserPlanProvider>{children}</UserPlanProvider>;
};
