import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState, useEffect } from "react";

export function useFeatureFlag(flagName: string) {
  const isEnabled = useFeatureFlagEnabled(flagName);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof isEnabled !== "undefined") {
      setIsInitialized(true);
    }
  }, [isEnabled]);

  return {
    isInitialized,
    isEnabled,
  };
}
