import { useEffect } from "react";

export function useDebounce(effect: () => void, delay: number, deps: any[]) {
  useEffect(() => {
    const handler = setTimeout(() => effect(), delay);

    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
