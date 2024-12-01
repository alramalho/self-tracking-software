"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const logError = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        if (!backendUrl) {
          console.error("Backend URL not configured");
          return;
        }

        await fetch(`${backendUrl}/admin/public/log-error`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            error_message: error.message,
            error_digest: error.digest,
            url: window.location.href,
            referrer: document.referrer || 'direct',
            user_agent: window.navigator.userAgent,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (e) {
        // Silently fail if we can't log the error
        console.error("Failed to log error:", e);
      }
    };

    console.error("Global Error: ", error);
    logError();
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

            {process.env.NODE_ENV === "development" && (
              <div className="text-sm text-gray-500 max-w-md mx-auto mt-8 break-words">
                <p className="font-medium">Error details:</p>
                <p>{error.message}</p>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
