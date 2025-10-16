import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { type Activity } from "@tsw/prisma";
import { useState } from "react";
import { toast } from "react-hot-toast";

interface ActivityLoggerPopoverProps {
  open: boolean;
  onClose: () => void;
  selectedActivity: Activity;
  onSubmit: (data: { activityId: string; date: Date; quantity: number }) => void;
}

export function ActivityLoggerPopover({
  open,
  onClose,
  selectedActivity,
  onSubmit,
}: ActivityLoggerPopoverProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [quantity, setQuantity] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleQuantityChange = (amount: number) => {
    setQuantity(Math.max(0, quantity + amount));
  };

  const handleQuickSelect = (value: number) => {
    setQuantity(value);
  };

  const handleSubmit = () => {
    if (!selectedDate) {
      toast.error("Please select a date.");
      return;
    }

    if (quantity === 0) {
      toast.error("Please set a quantity.");
      return;
    }

    setIsSubmitting(true);
    try {
      console.log({ selectedDate });
      onSubmit({
        activityId: selectedActivity.id,
        date: selectedDate,
        quantity,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="space-y-6 p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">
            Log {selectedActivity.title}
          </h2>
          <div className="text-4xl mb-4">{selectedActivity.emoji}</div>
          <p className="text-xs font-normal text-center my-4">
            <span className="italic">📍 {currentTimezone}</span>
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-center">
            Select Date
          </h3>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date: Date | undefined) => {
              if (date) {
                date.setHours(12, 0, 0, 0);
                setSelectedDate(date);
              }
            }}
            className="rounded-md border mx-auto"
            disableFutureDates={true}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4 text-center">
            how many <i>{selectedActivity.measure}</i>?
          </h3>
          <div className="flex items-center justify-center space-x-4">
            <Button
              onClick={() => handleQuantityChange(-1)}
              variant="outline"
              size="icon"
              className="bg-card"
            >
              -
            </Button>
            <span className="text-2xl font-bold">{quantity}</span>
            <Button
              onClick={() => handleQuantityChange(1)}
              variant="outline"
              size="icon"
              className="bg-card"
            >
              +
            </Button>
          </div>
          <div className="mt-4 flex justify-center space-x-2">
            {[10, 30, 45, 60, 90].map((value) => (
              <Button
                key={value}
                onClick={() => handleQuickSelect(value)}
                variant="secondary"
                className="bg-card"
                size="sm"
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        <Button
          className="w-full"
          disabled={quantity === 0 || !selectedDate || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "Logging..." : "Log Activity"}
        </Button>
      </div>
    </AppleLikePopover>
  );
}
