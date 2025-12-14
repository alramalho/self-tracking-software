import { createContext } from "react";

export interface UpgradeContextType {
  showUpgradePopover: boolean;
  setShowUpgradePopover: (show: boolean) => void;
  onUpgradePopoverClose: (() => void) | null;
  setOnUpgradePopoverClose: (callback: (() => void) | null) => void;
}

export const UpgradeContext = createContext<UpgradeContextType | undefined>(undefined);