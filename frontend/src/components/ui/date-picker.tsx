"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  disablePastDates?: boolean;
  disableFutureDates?: boolean;
  id?: string;
  className?: string;
}

export function DatePicker({
  selected,
  onSelect,
  disablePastDates,
  disableFutureDates,
  id,
  className,
}: DatePickerProps) {
  // const [open, setOpen] = React.useState(false)
  const today = new Date();
  const minDate = disablePastDates ? format(today, 'yyyy-MM-dd') : undefined;
  const maxDate = disableFutureDates ? format(today, 'yyyy-MM-dd') : undefined;

  return (
    <input
      type="date"
      value={selected ? format(selected, 'yyyy-MM-dd') : ''}
      onChange={(e) => {
        const date = e.target.value ? new Date(e.target.value) : undefined;
        onSelect(date);
        // setOpen(false);
      }}
      min={minDate}
      max={maxDate}
      className={cn(
        "w-full p-2 border rounded-md",
        className
      )}
    />
    // <Popover open={open} onOpenChange={setOpen}>
    //   <PopoverTrigger asChild>
    //     <Button
    //       id={id}
    //       onClick={() => setOpen(open => !open)}
    //       variant={"outline"}
    //       className={cn(
    //         "w-[280px] justify-start text-left font-normal",
    //         className,
    //         !selected && "text-muted-foreground"
    //       )}
    //     >
    //       <CalendarIcon className="mr-2 h-4 w-4" />
    //       {selected ? format(selected, "PP") : <span>Pick a date</span>}
    //     </Button>
    //   </PopoverTrigger>
    //   <PopoverContent className="w-auto p-0">
    //     <Calendar
    //       mode="single"
    //       selected={selected}
    //       onSelect={(date) => {
    //         onSelect(date);
    //         setOpen(false);
    //       }}
    //       initialFocus
    //       disabled={disabledDays}
    //     />
    //   </PopoverContent>
    // </Popover>
  )
}
