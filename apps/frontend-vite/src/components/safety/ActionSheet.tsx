import AppleLikePopover from "@/components/AppleLikePopover";
import { cn } from "@/lib/utils";
import type { ActionSheetProps } from "./types";

// A titled list of actions, like the native action sheet. Destructive ones are red.
export function ActionSheet({ title, actions, open, onClose }: ActionSheetProps) {
  return (
    <AppleLikePopover open={open} onClose={onClose} title={title ?? "Options"}>
      <div className="flex flex-col gap-3 pt-2">
        {title && (
          <p className="text-center text-sm text-muted-foreground pr-8 pl-8">
            {title}
          </p>
        )}
        <div className="overflow-hidden rounded-2xl bg-card border border-border">
          {actions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                // Run first, inside the click, so copying to the clipboard is still allowed.
                action.onPress();
                onClose();
              }}
              className={cn(
                "w-full min-h-[52px] px-4 text-left text-base transition-colors hover:bg-muted/60",
                index > 0 && "border-t border-border",
                action.destructive ? "text-red-500" : "text-foreground"
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[52px] rounded-2xl bg-card border border-border text-base font-semibold text-foreground hover:bg-muted/60"
        >
          Cancel
        </button>
      </div>
    </AppleLikePopover>
  );
}
