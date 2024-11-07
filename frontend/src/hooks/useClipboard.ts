import React, { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";

interface UseClipboardOptions {
  duration?: number;
  onCopy?: () => void;
  onError?: (error: Error) => void;
}

interface UseClipboardReturn {
  copied: boolean;
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
}

export const useClipboard = (
  options: UseClipboardOptions = {}
): UseClipboardReturn => {
  const { duration = 2000, onCopy, onError } = options;

  const [copied, setCopied] = useState<boolean>(false);

  const reset = useCallback(() => {
    setCopied(false);
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (!text) return false;

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        onCopy?.();
        setTimeout(reset, duration);
        return true;
      } catch (err) {
        // Fallback for older browsers
        try {
          const textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();

          const success = document.execCommand("copy");
          document.body.removeChild(textArea);

          if (success) {
            setCopied(true);
            onCopy?.();
            setTimeout(reset, duration);
            return true;
          }
          throw new Error("execCommand failed");
        } catch (fallbackErr) {
          const error =
            fallbackErr instanceof Error
              ? fallbackErr
              : new Error("Failed to copy text");
          console.error(error);
          onError?.(error);
          return false;
        }
      }
    },
    [duration, onCopy, onError, reset]
  );

  return { copied, copy, reset };
};
