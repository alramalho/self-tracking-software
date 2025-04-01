"use client";

import { useSession, SignOutButton, useClerk } from "@clerk/clerk-react";
import BottomNav from "../components/BottomNav";
import { Toaster } from "react-hot-toast";
import { UserPlanProviderWrapper } from "@/components/UserPlanProviderWrapper";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GeneralInitializer from "@/components/GeneralInitializer";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LoggerProvider } from "@/components/LoggerProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UpgradeProvider } from "@/contexts/UpgradeContext";
import { DailyCheckinPopoverProvider } from "@/contexts/DailyCheckinContext";

const queryClient = new QueryClient();

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded } = useSession();

  return (
    <QueryClientProvider client={queryClient}>
      <LoggerProvider>
        <UserPlanProviderWrapper>
          <ThemeProvider>
            <UpgradeProvider>
              <DailyCheckinPopoverProvider>
                <NotificationsProvider>
                  <main className="relative h-[100dvh]
                            [background-image:linear-gradient(#f0f0f0_1px,transparent_1px),linear-gradient(to_right,#f0f0f0_1px,#f8f8f8_1px)] 
                            [background-size:20px_20px] flex flex-col items-center justify-center p-4"
                  >
                    <div
                      className={cn(
                        "absolute inset-0 overflow-auto",
                        isSignedIn ? "pb-[4.7rem]" : ""
                      )}
                    >
                      <GeneralInitializer>{children}</GeneralInitializer>
                    </div>
                  </main>
                  <Toaster
                    position="top-center"
                    containerStyle={{
                      bottom: "5rem",
                      zIndex: 105,
                    }}
                  />
                </NotificationsProvider>
              </DailyCheckinPopoverProvider>
            </UpgradeProvider>
          </ThemeProvider>
        </UserPlanProviderWrapper>
      </LoggerProvider>
    </QueryClientProvider>
  );
}
