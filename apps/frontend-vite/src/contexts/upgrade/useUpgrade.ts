import { useContext } from "react";
import { UpgradeContext } from "./types";

export const useUpgrade = () => {
  const context = useContext(UpgradeContext);
  if (context === undefined) {
    throw new Error('useUpgrade must be used within a UpgradeProvider');
  }
  return context;
};