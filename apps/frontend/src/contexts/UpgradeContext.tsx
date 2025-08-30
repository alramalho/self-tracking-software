import { fetchUserPlanType } from '@/app/actions';
import { UpgradePopover } from '@/components/UpgradePopover';
import { useQuery } from '@tanstack/react-query';
import React, { createContext, useContext, useState } from 'react';

interface UpgradeContextType {
  showUpgradePopover: boolean;
  setShowUpgradePopover: (show: boolean) => void;
  isUserPremium: boolean;
}

const UpgradeContext = createContext<UpgradeContextType | undefined>(undefined);

export const UpgradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showUpgradePopover, setShowUpgradePopover] = useState(false);

  const { data: userPlanType } = useQuery({
    queryKey: ["userPlanType"],
    queryFn: async () => {
      const  planType = await fetchUserPlanType();
      console.log("User plan type:", planType);
      return planType;
    },
    refetchInterval: 3000,
    enabled: showUpgradePopover,
  });

  const isUserPremium = userPlanType === "PLUS";

  return (
    <UpgradeContext.Provider value={{ showUpgradePopover, setShowUpgradePopover, isUserPremium }}>
      {children}
      <UpgradePopover 
        open={showUpgradePopover} 
        onClose={() => setShowUpgradePopover(false)} 
      />
    </UpgradeContext.Provider>
  );
};

export const useUpgrade = () => {
  const context = useContext(UpgradeContext);
  if (context === undefined) {
    throw new Error('useUpgrade must be used within a UpgradeProvider');
  }
  return context;
}; 