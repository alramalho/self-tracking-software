"use client";

import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";

export function LoggerProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    // Dynamic import to ensure it only runs on client
    import("@/utils/logger").then(async ({ logger }) => {
      const token = await getToken();
      logger.setAuthToken(token);
      
      // Set user info if available
      if (user) {
        logger.setUserInfo({
          email: user.primaryEmailAddress?.emailAddress,
          username: user.username,
        });
      }
      
      console.log("✨ Logger initialized");
    });

    // Cleanup on unmount
    return () => {
      import("@/utils/logger").then(({ logger }) => {
        logger.setAuthToken(null);
        logger.setUserInfo(null);
      });
    };
  }, [getToken, user]);

  return <>{children}</>;
} 