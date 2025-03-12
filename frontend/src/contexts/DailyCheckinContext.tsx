import React, { createContext, useContext, useState } from "react";
import { DailyCheckinBanner } from "@/components/DailyCheckinBanner";
import { useDailyCheckin } from "@/hooks/useDailyCheckin";

interface DailyCheckinContextType {
  show: (initialMessage?: string) => void;
  wasSubmittedToday: boolean;
}

const DailyCheckinContext = createContext<DailyCheckinContextType | undefined>(undefined);

export const useDailyCheckinPopover = () => {
  const context = useContext(DailyCheckinContext);
  if (!context) {
    throw new Error("useDailyCheckinPopover must be used within a DailyCheckinPopoverProvider");
  }
  return context;
};

export const DailyCheckinPopoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showDailyCheckinPopover, setShowDailyCheckinPopover] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined);
  const { wasSubmittedToday, markAsSubmitted } = useDailyCheckin();

  return (
    <DailyCheckinContext.Provider 
      value={{ 
        show: (initialMessage?: string) => {
          setInitialMessage(initialMessage);
          setShowDailyCheckinPopover(true);
        },
        wasSubmittedToday
      }}
    >
      {children}
      <DailyCheckinBanner 
        open={showDailyCheckinPopover} 
        onClose={() => setShowDailyCheckinPopover(false)} 
        initialMessage={initialMessage}
      />
    </DailyCheckinContext.Provider>
  );
}; 