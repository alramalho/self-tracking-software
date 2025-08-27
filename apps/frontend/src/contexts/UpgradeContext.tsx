import React, { createContext, useContext, useState } from 'react';
import { UpgradePopover } from '@/components/UpgradePopover';

interface UpgradeContextType {
  showUpgradePopover: boolean;
  setShowUpgradePopover: (show: boolean) => void;
}

const UpgradeContext = createContext<UpgradeContextType | undefined>(undefined);

export const UpgradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showUpgradePopover, setShowUpgradePopover] = useState(false);

  return (
    <UpgradeContext.Provider value={{ showUpgradePopover, setShowUpgradePopover }}>
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