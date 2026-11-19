import { useApiWithAuth } from "@/api";
import { AnalyticsDashboard, Centered } from "@/components/analytics/AnalyticsDashboard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

// tracking.so/analytics redirects here. Private: the backend only answers ANALYTICS_EMAILS.
export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const api = useApiWithAuth();
  const { signOut } = useAuth();
  const access = useQuery({
    queryKey: ["analytics-access"],
    queryFn: async () => (await api.get<{ allowed: boolean }>("/analytics/access")).data.allowed,
    retry: false,
  });

  if (access.isLoading)
    return (
      <Centered>
        <Loader2 className="size-6 animate-spin" />
      </Centered>
    );
  if (!access.data)
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Not allowed</h1>
        <p className="text-sm text-muted-foreground">This page is private.</p>
        <Button variant="outline" onClick={() => void signOut({ redirectUrl: "/signin?redirect_url=/analytics" })}>
          Sign out
        </Button>
      </Centered>
    );
  return <AnalyticsDashboard />;
}
