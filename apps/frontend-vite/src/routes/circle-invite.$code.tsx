import { useCircleInvite } from "@/components/circles/api";
import { CircleCardView } from "@/components/circles/components";
import { JoinDialog } from "@/components/circles/JoinDialog";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/circle-invite/$code")({
  component: CircleInvitePage,
});

// Opened from a friend's invite link. Signed-out visitors are sent to sign in first
// and come back here afterwards (GeneralInitializer's redirect_url).
function CircleInvitePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const invite = useCircleInvite(code);
  const [open, setOpen] = useState(true);

  return (
    <div className="container mx-auto flex max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => window.history.back()}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Circle invite</h1>
      </div>
      {invite.isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {invite.error && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-muted-foreground">
            {toApiErrorMessage(invite.error, "This invite may have expired or been removed.")}
          </p>
          <Button variant="outline" onClick={() => navigate({ to: "/" })}>
            Go home
          </Button>
        </div>
      )}
      {invite.data && <CircleCardView card={invite.data} onPress={() => setOpen(true)} />}
      <JoinDialog
        card={open ? (invite.data ?? null) : null}
        inviteCode={code}
        onClose={() => setOpen(false)}
        onJoined={(id) => navigate({ to: "/circle/$id", params: { id }, replace: true })}
      />
    </div>
  );
}
