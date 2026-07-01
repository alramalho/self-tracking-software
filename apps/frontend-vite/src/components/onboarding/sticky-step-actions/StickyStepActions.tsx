import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";
import type { StickyStepActionsProps } from "./types";

export function StickyStepActions({
  primaryLabel,
  onPrimaryClick,
  primaryDisabled,
  secondaryLabel,
  onSecondaryClick,
}: StickyStepActionsProps) {
  const actions = (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-12px_30px_rgba(0,0,0,0.18)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto w-full max-w-md space-y-2">
        <Button
          className="h-11 w-full"
          onClick={onPrimaryClick}
          disabled={primaryDisabled}
        >
          {primaryLabel}
        </Button>
        {secondaryLabel && onSecondaryClick && (
          <Button
            variant="ghost"
            className="h-8 w-full text-muted-foreground"
            onClick={onSecondaryClick}
          >
            {secondaryLabel}
          </Button>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return actions;

  return createPortal(actions, document.body);
}
