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
    <div className="flex flex-col items-center justify-center p-4">
      <div className="space-y-6 w-full max-w-md mx-auto">{children}</div>
    </div>
  );
};
