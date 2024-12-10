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

const queryClient = new QueryClient();

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded } = useSession();

  const [showServerMessage, setShowServerMessage] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowServerMessage(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  if (!isLoaded) {

    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin mr-3" />
        <div className="flex flex-col items-start">
          <p className="text-left">Loading your data...</p>
          {showServerMessage && (
            <span className="text-gray-500 text-sm text-left">
              we run on cheap servers...<br/>
              <Link target="_blank" href="https://ko-fi.com/alexramalho" className="underline">donate?</Link>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <UserPlanProviderWrapper>
        <main className="pb-16 relative">
          <GeneralInitializer />
          {children}
          {isSignedIn && <BottomNav />}
        </main>
        <Toaster
          position="top-center"
          containerStyle={{
            bottom: "5rem",
            zIndex: 101,
          }}
        />
      </UserPlanProviderWrapper>
    </QueryClientProvider>
  );
}
