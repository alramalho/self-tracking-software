import { cn } from "@/lib/utils";
import type { SearchTab, SearchTabsProps } from "./types";

const tabLabels: Record<SearchTab, string> = { people: "People", circles: "Circles" };

// Same pill control as the app's Search screen.
export function SearchTabs({ value, onChange }: SearchTabsProps) {
  return (
    <div role="tablist" className="flex gap-1 rounded-3xl bg-muted p-1">
      {(Object.keys(tabLabels) as SearchTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={cn(
            "flex min-h-[44px] flex-1 items-center justify-center rounded-[22px] font-semibold transition-colors",
            value === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          {tabLabels[tab]}
        </button>
      ))}
    </div>
  );
}
