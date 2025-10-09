import { useUser } from "@/contexts/auth";

export const useLogError = () => {
  const { supabaseUser: user } = useUser();

  const handleQueryError = (
    error: Error & { digest?: string; response?: any; status?: number },
    customErrorMessage: string
  ) => {
    const axiosErrorDetails = error.response
      ? ` [${error.response.status} ${
          error.response.statusText
        }] ${JSON.stringify(error.response.data)}`
      : "";

    const customError = {
      ...error,
      digest: error.digest || "",
      message:
        "(useQuery Error) " +
          customErrorMessage +
          " / " +
          error.message +
          axiosErrorDetails || "",
    };
    console.error(customError);
    logError(customError);
  };

  const logError = async (
    error: Error & { digest?: string },
    url?: string,
    clerkId?: string
  ) => {
    const userClerkId = clerkId || user?.id;

    try {
      const backendUrl = import.meta.env.VITE_API_URL;
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
          url: url || window.location.href,
          referrer: document.referrer || "direct",
          user_agent: window.navigator.userAgent,
          timestamp: new Date().toISOString(),
          user_clerk_id: userClerkId,
        }),
      });
    } catch (e) {
      console.error("Failed to log error:", e);
    }
  };

  return { logError, handleQueryError };
};
