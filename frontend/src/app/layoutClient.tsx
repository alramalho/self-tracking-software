"use client";

import { useSession, SignOutButton, useClerk } from "@clerk/clerk-react";
import BottomNav from "../components/BottomNav";
import { Toaster } from "react-hot-toast";
import { UserPlanProviderWrapper } from "@/components/UserPlanProviderWrapper";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GeneralInitializer from "@/components/GeneralInitializer";

const queryClient = new QueryClient();

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded } = useSession();

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2">Loading app</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <UserPlanProviderWrapper>
        <main className="pb-16">
          <GeneralInitializer />
          {children}
        </main>
        <Toaster
          position="bottom-center"
          containerStyle={{
            bottom: "5rem",
          }}
        />
        {isSignedIn && <BottomNav />}
      </UserPlanProviderWrapper>
    </QueryClientProvider>
  );
}
