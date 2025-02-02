"use client";

import { useEffect } from "react";

export function LoggerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log("Initializing logger 📍");
    // Dynamic import to ensure it only runs on client
    import("@/utils/logger").then(() => {
      console.log("✨ Logger initialized");
    });
  }, []);

  return <>{children}</>;
} 