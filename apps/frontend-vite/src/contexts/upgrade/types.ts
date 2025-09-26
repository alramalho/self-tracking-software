import { createContext } from "react";

export interface UpgradeContextType {
  showUpgradePopover: boolean;
  setShowUpgradePopover: (show: boolean) => void;
}

export const UpgradeContext = createContext<UpgradeContextType | undefined>(undefined);