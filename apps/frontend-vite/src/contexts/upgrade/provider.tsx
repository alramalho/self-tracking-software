import { UpgradePopover } from '@/components/UpgradePopover';
import React, { useCallback, useRef, useState } from 'react';
import { UpgradeContext, type UpgradeContextType } from './types';

export const UpgradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showUpgradePopover, setShowUpgradePopover] = useState(false);
  const onCloseCallbackRef = useRef<(() => void) | null>(null);

  const setOnUpgradePopoverClose = useCallback((callback: (() => void) | null) => {
    onCloseCallbackRef.current = callback;
  }, []);

  const handleClose = useCallback(() => {
    setShowUpgradePopover(false);
    if (onCloseCallbackRef.current) {
      onCloseCallbackRef.current();
      onCloseCallbackRef.current = null;
    }
  }, []);

  const context: UpgradeContextType = {
    showUpgradePopover,
    setShowUpgradePopover,
    onUpgradePopoverClose: onCloseCallbackRef.current,
    setOnUpgradePopoverClose,
  };

  return (
    <UpgradeContext.Provider value={context}>
      {children}
      <UpgradePopover
        open={showUpgradePopover}
        onClose={handleClose}
      />
    </UpgradeContext.Provider>
  );
};