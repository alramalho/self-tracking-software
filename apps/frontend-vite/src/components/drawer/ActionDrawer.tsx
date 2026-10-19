import { ChevronRight, Loader2 } from "lucide-react";
import AppleLikePopover from "@/components/AppleLikePopover";
import { cn } from "@/lib/utils";
import type {
  ActionDrawerProps,
  DrawerButtonProps,
  DrawerHeaderProps,
  DrawerOptionsProps,
} from "./types";

// The app's drawer, as on iPhone: closed with the X, a swipe or a tap outside. Inside, in this
// order: a centred header, a card of vertical options, at most one main button.
export function ActionDrawer({ open, label, onClose, children }: ActionDrawerProps) {
  return (
    <AppleLikePopover open={open} onClose={onClose} title={label}>
      <div className="flex flex-col gap-5 pt-2 pb-2">{children}</div>
    </AppleLikePopover>
  );
}

export function DrawerHeader({ emoji, title, subtitle }: DrawerHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-8 pt-2 text-center">
      {emoji && <span className="text-4xl leading-none">{emoji}</span>}
      <h2 className="text-xl font-bold text-balance">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function DrawerOptions({ label, options }: DrawerOptionsProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="px-1 text-[13px] font-semibold text-muted-foreground">{label}</p>}
      <div className="overflow-hidden rounded-2xl bg-card">
        {options.map((option, index) => {
          const row = (
            <>
              <span className={cn("flex-1 text-base font-medium", option.destructive && "text-red-600")}>
                {option.label}
              </span>
              {option.trailing ??
                (option.onClick && !option.destructive ? (
                  <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
                ) : null)}
            </>
          );
          const className = cn(
            "flex min-h-14 w-full items-center gap-3 px-[18px] text-left",
            index > 0 && "border-t border-border",
            option.disabled && "opacity-45",
          );
          return option.trailing ? (
            <div key={option.label} data-testid={option.testId} className={className}>
              {row}
            </div>
          ) : (
            <button
              key={option.label}
              type="button"
              data-testid={option.testId}
              disabled={option.disabled}
              onClick={option.onClick}
              className={cn(className, "transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none")}
            >
              {row}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DrawerButton({ label, onClick, busy, disabled, testId }: DrawerButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled || busy}
      onClick={onClick}
      className="flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-primary text-base font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-45"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : label}
    </button>
  );
}
