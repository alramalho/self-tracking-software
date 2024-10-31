"use client";

import { useSession, SignOutButton, useClerk } from "@clerk/clerk-react";
import BottomNav from "../components/BottomNav";
import { Toaster } from "react-hot-toast";
import { UserPlanProviderWrapper } from "@/components/UserPlanProviderWrapper";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { UserPlanProvider } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";

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
    <>
      <main className="pb-16">
        <UserPlanProvider>
          <UserPlanProviderWrapper>{children}</UserPlanProviderWrapper>
        </UserPlanProvider>
      </main>
      <Toaster
        position="bottom-center"
        containerStyle={{
          bottom: "5rem",
        }}
      />
      {isSignedIn && <BottomNav />}
    </>
  );
}
