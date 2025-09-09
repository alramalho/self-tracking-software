"use client";

import { Button } from "@/components/ui/button";
import { useLogError } from "@/hooks/useLogError";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { logError } = useLogError();
  
  useEffect(() => {
    console.error("Global Error: ", error);
    logError(error, typeof window !== 'undefined' ? window.location.href : undefined);
  }, [error]);

  return (
    <html>
    <body>
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50">
          <div className="text-center space-y-6">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />

            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter">
                Something went wrong
              </h1>
              <p className="text-gray-500">
                We apologize for the inconvenience. Please try again later.
              </p>
            </div>

            <Button
              onClick={() => {
                window.location.href = "/";
              }}
              className="bg-primary hover:bg-primary/90"
            >
              Go to Home
            </Button>

            <div className="text-sm text-gray-500 max-w-md mx-auto mt-8 break-words">
              <p className="font-medium">Error details:</p>
              <p>{error.message}</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
