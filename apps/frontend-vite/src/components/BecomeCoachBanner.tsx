import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";

const ALLOWED_USERNAMES = ["diogox73"];

interface BecomeCoachBannerProps {
  username: string | null | undefined;
}

export function BecomeCoachBanner({ username }: BecomeCoachBannerProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem("become-coach-banner-dismissed") === "true";
  });
  const navigate = useNavigate();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Only show for allowed usernames who haven't dismissed it
  if (!username || !ALLOWED_USERNAMES.includes(username) || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem("become-coach-banner-dismissed", "true");
    setIsDismissed(true);
  };

  const handleBecomeCoach = () => {
    navigate({ to: "/create-coach-profile" });
  };

  return (
    <div
      className={`relative ${variants.verySoftGrandientBg} border ${variants.brightBorder} rounded-xl p-4`}
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-white/50 dark:hover:bg-black/20 rounded-full transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex-shrink-0">
          <Users className={`w-5 h-5 ${variants.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground mb-1">
            Become a coach
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Share your expertise and help others achieve their goals. Create your coach profile today.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              className="flex items-center gap-1"
              onClick={handleBecomeCoach}
            >
              Get started
              <ArrowRight className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
            >
              Maybe later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
