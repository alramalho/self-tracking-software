import { Button } from "@/components/ui/button";
import { logGlobalError } from "@/utils/errorLogger";
import { ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

export function GlobalErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  useEffect(() => {
    console.error("Global Error: ", error);
    logGlobalError(
      error instanceof Error ? error : new Error(String(error)),
      typeof window !== "undefined" ? window.location.href : undefined
    );
    localStorage.removeItem("TRACKING_SO_QUERY_CACHE");
  }, [error]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center space-y-6">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter">
            Something went wrong
          </h1>
          <p className="text-gray-500">
            We apologize for the inconvenience.<br/>Please try again later.
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => {
              router.navigate({ to: "/" });
            }}
            className="bg-primary hover:bg-primary/90"
          >
            Go Home
          </Button>
        </div>

        <div className="text-sm text-gray-500 max-w-md mx-auto mt-8 break-words">
          <p className="font-medium">Error details:</p>
          <p>{error instanceof Error ? error.message : String(error)}</p>
        </div>
      </div>
    </div>
  );
}

