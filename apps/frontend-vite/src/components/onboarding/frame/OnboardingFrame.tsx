import { motion, MotionConfig } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { OnboardingFrameProps } from "../types";

// One screen of onboarding, laid out like the native app: back, a short progress line and
// Skip (or close) on top; the question centred; one dominant action pinned to the bottom,
// with the content fading out under it instead of a dividing line.
export function OnboardingFrame({
  screenKey,
  progress,
  bare = false,
  busy = false,
  backDisabled = false,
  onBack,
  onSkip,
  onClose,
  actions,
  children,
}: OnboardingFrameProps) {
  const theme = useThemeColors();
  const share = progress ? Math.min(100, (progress.current / progress.total) * 100) : 0;
  return (
    <MotionConfig reducedMotion="user">
      <div
        data-testid="onboarding-screen"
        className="fixed inset-0 z-40 flex flex-col bg-background pt-[env(safe-area-inset-top)]"
      >
        <header className="flex min-h-[52px] items-center justify-between px-4 pb-2 pt-1">
          <div className="flex w-16 justify-start">
            {onBack && (
              <button
                type="button"
                aria-label="Previous question"
                disabled={busy || backDisabled}
                onClick={onBack}
                className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-opacity hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={2} />
              </button>
            )}
          </div>
          {!bare && progress && (
            <div
              role="progressbar"
              aria-label="Onboarding progress"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.current}
              className="h-1 w-[88px] overflow-hidden rounded-full bg-muted"
            >
              <div className={`h-1 rounded-full ${theme.bg} transition-[width] duration-300`} style={{ width: `${share}%` }} />
            </div>
          )}
          <div className="flex w-16 justify-end">
            {onSkip ? (
              <button
                type="button"
                aria-label="Skip this question"
                disabled={busy}
                onClick={onSkip}
                className="py-2.5 text-base text-muted-foreground transition-opacity hover:text-foreground disabled:opacity-50"
              >
                Skip
              </button>
            ) : (
              onClose && (
                <button
                  type="button"
                  aria-label="Close onboarding"
                  disabled={busy}
                  onClick={onClose}
                  className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted disabled:opacity-30"
                >
                  <X className="h-6 w-6" strokeWidth={2} />
                </button>
              )
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={screenKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="flex min-h-full flex-col justify-center px-7 pb-10 pt-3"
          >
            <div className="mx-auto flex w-full max-w-[448px] flex-col gap-6">{children}</div>
          </motion.div>
        </main>

        {actions && (
          <motion.footer
            key={`actions-${screenKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.24, delay: 0.3 }}
            className="relative bg-background px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-2"
          >
            <div className="pointer-events-none absolute inset-x-0 -top-7 h-7 bg-gradient-to-b from-transparent to-background" />
            <div className="mx-auto flex w-full max-w-[448px] flex-col gap-3">{actions}</div>
          </motion.footer>
        )}
      </div>
    </MotionConfig>
  );
}
