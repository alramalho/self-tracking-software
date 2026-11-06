import { ChevronRight, Check, type LucideIcon } from "lucide-react";
import React from "react";
import { twMerge } from "tailwind-merge";

interface SettingsGroupProps {
  title?: string;
  /** Small print under the group, like iOS Settings footers. */
  footer?: string;
  children: React.ReactNode;
}

interface SettingsRowProps {
  icon?: LucideIcon;
  title: string;
  onClick?: () => void;
  /** Current value, shown muted before the chevron (e.g. "Dark · Amber"). */
  value?: string;
  /** Replaces the chevron, e.g. a Switch or swatches. */
  trailing?: React.ReactNode;
  chevron?: boolean;
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

/** An inset group of rows, like a section in iOS Settings (same as the iPhone app). */
export function SettingsGroup({ title, footer, children }: SettingsGroupProps) {
  const rows = React.Children.toArray(children).filter(Boolean);
  if (!rows.length) return null;
  return (
    <section className="flex flex-col gap-1.5">
      {title && (
        <h3 className="px-3.5 text-[13px] uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      )}
      <div className="rounded-[20px] bg-card px-4 divide-y divide-border">
        {rows}
      </div>
      {footer && (
        <p className="px-3.5 text-[13px] leading-[18px] text-muted-foreground">{footer}</p>
      )}
    </section>
  );
}

export function SettingsRow({
  icon: Icon,
  title,
  onClick,
  value,
  trailing,
  chevron,
  selected,
  destructive,
  disabled,
}: SettingsRowProps) {
  const content = (
    <>
      {Icon && <Icon size={24} strokeWidth={1.8} />}
      <span className="flex-1 text-left text-base">{title}</span>
      {value && (
        <span className="max-w-[50%] truncate text-[15px] text-muted-foreground">{value}</span>
      )}
      {trailing}
      {selected && <Check size={20} className="text-primary" />}
      {chevron && <ChevronRight size={18} className="-ml-1 text-muted-foreground" />}
    </>
  );
  const className = twMerge(
    "flex min-h-[52px] w-full items-center gap-3",
    destructive && "text-red-500",
    disabled && "opacity-50"
  );
  if (!onClick) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={twMerge(className, "transition-opacity active:opacity-55")}
    >
      {content}
    </button>
  );
}
