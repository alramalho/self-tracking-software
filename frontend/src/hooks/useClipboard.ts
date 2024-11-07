import { useState } from "react";

type CopyFn = (text: string) => Promise<boolean>;

export function useClipboard(): [boolean, CopyFn] {
  const [copied, setCopied] = useState(false);

  const copy: CopyFn = async (text) => {
    // 1. Try Share API first (best for mobile PWAs)
    if (navigator.share) {
      try {
        await navigator.share({ text });
        setCopied(true);
        return true;
      } catch (error) {
        // User might have cancelled - try next method
      }
    }

    // 2. Try Clipboard API
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        return true;
      } catch (error) {
        // Clipboard API failed - try next method
      }
    }

    // 3. Selection API fallback
    try {
      const range = document.createRange();
      const selection = window.getSelection();

      const tempElement = document.createElement("div");
      tempElement.innerHTML = text;
      tempElement.style.position = "absolute";
      tempElement.style.left = "-9999px";
      document.body.appendChild(tempElement);

      range.selectNodeContents(tempElement);
      selection?.removeAllRanges();
      selection?.addRange(range);

      const successful = document.execCommand("copy");
      selection?.removeAllRanges();
      document.body.removeChild(tempElement);

      if (successful) {
        setCopied(true);
        return true;
      }
    } catch (err) {
      console.warn("Copy failed:", err);
    }

    setCopied(false);
    return false;
  };

  return [copied, copy];
}
