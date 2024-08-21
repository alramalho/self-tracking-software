'use client'

import { useSession, SignOutButton } from '@clerk/clerk-react'
import BottomNav from "../components/BottomNav";
import { Toaster } from "react-hot-toast";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useSession();

  return (
    <> 
      <main className="pb-16">{children}</main>
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