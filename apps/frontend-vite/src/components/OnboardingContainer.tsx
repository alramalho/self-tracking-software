import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

export const OnboardingContainer = ({
  children,
  name,
}: {
  children: React.ReactNode;
  name: string;
}) => {
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture(`onboarding-${name}-view`);
  }, [posthog, name]);

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto overscroll-contain px-4 pb-8 pt-12 [-webkit-overflow-scrolling:touch]">
      <div className="space-y-6 w-full max-w-md mx-auto">{children}</div>
    </div>
  );
};
