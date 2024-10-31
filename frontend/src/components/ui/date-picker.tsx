"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePicker({ selected, onSelect, disablePastDates = false, disableFutureDates = false }: { selected?: Date; onSelect: (date: Date | undefined) => void, disablePastDates?: boolean, disableFutureDates?: boolean }) {
  const today = new Date();
  const disabledDays = [];
  if (disablePastDates) {
    disabledDays.push({ from: new Date(0), to: new Date(today.getTime() - 86400000) });
  }
  if (disableFutureDates) {
    disabledDays.push({ from: new Date(today.getTime() + 86400000), to: new Date(2100, 0, 1) });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !selected && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={onSelect}
          initialFocus
          disabled={disabledDays}
        />
      </PopoverContent>
    </Popover>
  )
}
