import { authService } from "@/services/auth";

export const useLogError = () => {
  const handleQueryError = (
    error: Error & { digest?: string; response?: any; status?: number },
    customErrorMessage: string
  ) => {
    // Skip logging 401 authentication errors
    if (
      error.response?.status === 401 ||
      error.status === 401
      // (error as any).code === 401 ||
      // error.message?.includes("Request failed with status code 401")
    ) {
      return;
    }

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
    error: Error & { digest?: string; response?: any; status?: number },
    url?: string
  ) => {
    // Skip logging 401 authentication errors
    if (error.response?.status === 401 || error.status === 401) {
      return;
    }

    let userSupabaseId;
    try {
      const { data } = await authService.getCurrentUser();
      userSupabaseId = data.user?.id;
    } catch (e) {
      console.debug("Could not fetch user for error logging");
    }

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
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
          user_supabase_id: userSupabaseId,
        }),
      });
    } catch (e) {
      console.error("Failed to log error:", e);
    }
  };

  return { logError, handleQueryError };
};
