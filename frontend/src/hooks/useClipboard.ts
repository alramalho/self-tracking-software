import { useState } from "react";

type CopyFn = (text: string) => Promise<boolean>;

export function useClipboard(): [boolean, CopyFn] {
  const [copied, setCopied] = useState(false);

  const copy: CopyFn = async (text) => {
    if (!navigator?.clipboard) {
      console.warn("Clipboard not supported");
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      return true;
    } catch (error) {
      console.warn("Copy failed", error);
      setCopied(false);
      return false;
    }
  };

  return [copied, copy];
}
