"use client";

import { ZeroProvider } from "@rocicorp/zero/react";
import { useClerk, useSession, useUser } from "@clerk/clerk-react";
import { schema, createMutators } from "@/zero";
import { useEffect, useState } from "react";

interface ZeroProviderWrapperProps {
  children: React.ReactNode;
}

export function ZeroProviderWrapper({ children }: ZeroProviderWrapperProps) {
  const { user, isSignedIn, isLoaded } = useUser();
  // const [userId, setUserId] = useState<string | undefined>(undefined);
  const { signOut } = useClerk();
  const { session } = useSession();

  const server = process.env.NEXT_PUBLIC_ZERO_SERVER || "http://localhost:4848";

  useEffect(() => {
    const fetchUser = async () => {
      if (!isLoaded) return;

      if (!isSignedIn) {
        // setUserId("anon");
        console.log("not signed in");
        return;
      }

      // try {
      //   const actualUser = await getUser({ clerkId: user?.id });
      //   setUserId(actualUser?.id);
      // } catch (error) {
      //   console.error(`Error fetching user: ${error}`);
      //   setUserId("anon");
      // }
    };

    fetchUser();
  }, [user, isLoaded]);

  if (!isLoaded) {
    return <div>Loading...</div>;
  }
  // if (!userId) {
  //   return <div>Something went wrong</div>;
  // }

  console.log(`loaded clerk! clerkId: ${user?.id}`);

  return (
    <ZeroProvider
      userID={user?.id || "anon"}
      auth={async (error?: "invalid-token") => {
        if (error === "invalid-token") {
          signOut();
          return undefined;
        }
        if (!session) {
          return undefined;
        }
        const token = await session.getToken();
        console.log(`using auth token: ${token}`);
        return token || undefined;
      }}
      schema={schema}
      mutators={createMutators(isSignedIn ? user.id : "")}
      server={server}
    >
      {children}
    </ZeroProvider>
  );
}
