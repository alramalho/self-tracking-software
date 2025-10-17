import { Button } from "@/components/ui/button";
import { useLogError } from "@/hooks/useLogError";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

export function GlobalErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const { logError } = useLogError();

  function clearCache() {
    localStorage.removeItem("TRACKING_SO_QUERY_CACHE");
  }

  useEffect(() => {
    console.error("Global Error: ", error);
    logError(
      error instanceof Error ? error : new Error(String(error)),
      typeof window !== "undefined" ? window.location.href : undefined
    );
  }, [error, logError]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-muted">
      <div className="text-center space-y-6">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            We apologize for the inconvenience.<br/>Please try again later.
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => {
              clearCache()
              window.location.reload()
            }}
            className="bg-primary hover:bg-primary/90"
          >
            Retry
          </Button>
        </div>

        <div className="text-sm text-muted-foreground max-w-md mx-auto mt-8 break-words">
          <p className="font-medium">Error details:</p>
          <p>{error instanceof Error ? error.message : String(error)}</p>
        </div>
      </div>
    </div>
  );
}

