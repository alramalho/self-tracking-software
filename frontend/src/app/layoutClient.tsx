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

const queryClient = new QueryClient();

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded } = useSession();

  return (
    <QueryClientProvider client={queryClient}>
      <UserPlanProviderWrapper>
        <NotificationsProvider>
        <main
          className={cn(
            "relative overflow-scroll",
            isSignedIn ? "h-[calc(100dvh-4.7rem)]" : "h-[100dvh]"
          )}
        >
          <GeneralInitializer>{children}</GeneralInitializer>
        </main>
        <Toaster
          position="top-center"
          containerStyle={{
            bottom: "5rem",
            zIndex: 101,
          }}
          />
        </NotificationsProvider>
      </UserPlanProviderWrapper>
    </QueryClientProvider>
  );
}
