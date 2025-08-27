import { useLocalStorage } from "./useLocalStorage";

interface DismissalState {
  timestamp: number;
  dismissed: boolean;
}

export function useAINotificationDismissal(key: string) {
  const [state, setState] = useLocalStorage<DismissalState>(
    `ai-notification-${key}`,
    {
      timestamp: 0,
      dismissed: false,
    }
  );

  const isDismissed = () => {
    if (!state.dismissed) return false;

    const now = Date.now();
    const hoursSinceDismissal = (now - state.timestamp) / (1000 * 60 * 60);
    return hoursSinceDismissal < 24;
  };

  const dismiss = () => {
    setState({
      timestamp: Date.now(),
      dismissed: true,
    });
  };

  const reset = () => {
    setState({
      timestamp: 0,
      dismissed: false,
    });
  };

  return {
    isDismissed: isDismissed(),
    dismiss,
    reset,
  };
}
