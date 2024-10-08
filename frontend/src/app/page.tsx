"use client";

import { useSession } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiWithAuth } from "@/api";
import Link from "next/link";
import { Loader2 } from "lucide-react";

interface User {
  id: string;
  name: string;
  selected_plan_id: string | null;
}

export default function Home() {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const api = useApiWithAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      if (isSignedIn) {
        try {
          const response = await api.get('/api/user');
          const user: User = response.data;
          if (user.selected_plan_id) {
            router.push('/profile');
          } else {
            router.push('/onboarding');
          }
        } catch (error) {
          console.error('Error fetching user:', error);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    checkUserAndRedirect();
  }, [isSignedIn, router, api]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl mb-4">Welcome to tracking.so</h1>
      {!isSignedIn && (
        <Link
          href="/signin"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
