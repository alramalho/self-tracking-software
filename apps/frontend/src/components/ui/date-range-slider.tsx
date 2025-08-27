"use client";

import * as React from "react";
import { DualRangeSlider } from "./dual-slider";
import { format } from "date-fns";

interface DateRangeSliderProps {
  minDate: Date;
  maxDate: Date;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  className?: string;
}

export function DateRangeSlider({
  minDate,
  maxDate,
  value,
  onValueChange,
  className,
}: DateRangeSliderProps) {
  return (
    <div className="space-y-8">
      <span className="text-md font-medium">Date Range</span>
      <div className="space-y-2">
        <DualRangeSlider
          min={minDate.getTime()}
          max={maxDate.getTime()}
          step={86400000} // One day in milliseconds
          value={value}
          onValueChange={onValueChange}
          label={(value) =>
            value ? (
              <span className="absolute min-w-16 -top-1 text-xs font-medium bg-white px-2 py-1 rounded-md border shadow-sm">
                {format(value, "MMM d")}
              </span>
            ) : null
          }
          className={className}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <div>{format(minDate, "MMM d, yyyy")}</div>
          <div>{format(maxDate, "MMM d, yyyy")}</div>
        </div>
      </div>
    </div>
  );
}
