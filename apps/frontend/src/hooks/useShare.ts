import { useState } from "react";

export function useShare() {
  const isSupported = !!navigator.share;
  const [shared, setShared] = useState(false);

  const share = async (text: string): Promise<boolean> => {
    if (!navigator.share) return false;

    try {
      await navigator.share({ text });
      setShared(true);
      return true;
    } catch (error) {
      setShared(false);
      return false;
    }
  };

  return { shared, share, isSupported };
}
