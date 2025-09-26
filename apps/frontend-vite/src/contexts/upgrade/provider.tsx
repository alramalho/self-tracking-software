import { UpgradePopover } from '@/components/UpgradePopover';
import React, { useState } from 'react';
import { UpgradeContext, type UpgradeContextType } from './types';

export const UpgradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showUpgradePopover, setShowUpgradePopover] = useState(false);

  const context: UpgradeContextType = {
    showUpgradePopover,
    setShowUpgradePopover,
  };

  return (
    <UpgradeContext.Provider value={context}>
      {children}
      <UpgradePopover
        open={showUpgradePopover}
        onClose={() => setShowUpgradePopover(false)}
      />
    </UpgradeContext.Provider>
  );
};