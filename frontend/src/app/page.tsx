"use client";

import { useSession } from "@clerk/clerk-react";
import Link from "next/link";

export default function Home() {
  const { isSignedIn } = useSession();
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl mb-4">Welcome to tracking.so</h1>
      {isSignedIn ? (
        <>
        <Link
          href="/log"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Go to Log Page
        </Link>
        <Link
          href="/pwa"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Go to PWA Page
        </Link>
        </>
      ) : (
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
