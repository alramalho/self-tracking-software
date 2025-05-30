import { useState, useEffect, useCallback, useRef } from "react";

interface UseCeilingSwipeOptions {
  onRefresh: () => Promise<any>;
  pullThresholdToRefresh?: number; // Distance to pull to trigger the actual refresh
  pullDistanceForMaxPercentage?: number; // Distance over which scrollPercentage goes 0 to 1
}

interface UseCeilingSwipeResult {
  isRefreshing: boolean;
  showIcon: boolean; // Indicates a pull has started and UI might want to show an icon
  scrollPercentage: number; // 0 to 1, based on pullDistanceForMaxPercentage
}

export const useCeilingSwipe = ({
  onRefresh,
  pullThresholdToRefresh = 100,
  pullDistanceForMaxPercentage = 100,
}: UseCeilingSwipeOptions): UseCeilingSwipeResult => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [scrollStartPosition, setScrollStartPosition] = useState<number | null>(
    null
  );
  const touchStartScreenYRef = useRef<number>(0);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setShowIcon(false); // Hide icon indication once refresh starts
    setScrollPercentage(0);
    try {
      await onRefresh();
    } catch (error) {
      console.error("Error during refresh:", error);
    } finally {
      setIsRefreshing(false);
      setScrollStartPosition(null);
      touchStartScreenYRef.current = 0;
    }
  }, [onRefresh, isRefreshing]);

  useEffect(() => {
    const calculateAndSetStates = (pullDistance: number) => {
      if (pullDistance > 0) {
        setShowIcon(true);
        const percentage = Math.min(
          pullDistance / pullDistanceForMaxPercentage,
          1
        );
        setScrollPercentage(percentage);

        if (pullDistance > pullThresholdToRefresh && !isRefreshing) {
          handleRefresh();
        }
      } else {
        setShowIcon(false);
        setScrollPercentage(0);
        // Don't reset scrollStartPosition here for touch, touchend will handle
        // For scroll, if pullDistance <= 0 and we had a start, reset.
        if (
          scrollStartPosition !== null &&
          !("ontouchstart" in window || navigator.maxTouchPoints > 0)
        ) {
          setScrollStartPosition(null);
        }
      }
    };

    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (isRefreshing) return;

      if (scrollY < 0 && scrollStartPosition === null) {
        setScrollStartPosition(0);
        setShowIcon(true); // Initial indication
      } else if (scrollStartPosition !== null && scrollY <= 0) {
        const pullDistance = -scrollY;
        calculateAndSetStates(pullDistance);
      } else if (scrollY > 0 && scrollStartPosition !== null) {
        setShowIcon(false);
        setScrollPercentage(0);
        setScrollStartPosition(null);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        touchStartScreenYRef.current = e.touches[0].screenY;
        setScrollStartPosition(0);
        setShowIcon(true); // Initial indication on touch start if at top
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (scrollStartPosition === null || isRefreshing) return;
      const currentScreenY = e.touches[0].screenY;
      const pullDistance = currentScreenY - touchStartScreenYRef.current;
      calculateAndSetStates(pullDistance);
    };

    const handleTouchEnd = () => {
      if (!isRefreshing) {
        setShowIcon(false);
        setScrollPercentage(0);
      }
      if (!isRefreshing || scrollStartPosition !== null) {
        setScrollStartPosition(null);
        touchStartScreenYRef.current = 0;
      }
    };

    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (!isTouchDevice) {
      window.addEventListener("scroll", handleScroll);
    }
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      if (!isTouchDevice) {
        window.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [
    isRefreshing,
    handleRefresh,
    scrollStartPosition,
    pullThresholdToRefresh,
    pullDistanceForMaxPercentage,
  ]);

  return { isRefreshing, showIcon, scrollPercentage };
};
