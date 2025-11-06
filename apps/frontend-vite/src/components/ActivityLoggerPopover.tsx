import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { type Activity } from "@tsw/prisma";
import { useState } from "react";
import { toast } from "react-hot-toast";
import Picker from "react-mobile-picker";

interface ActivityLoggerPopoverProps {
  open: boolean;
  onClose: () => void;
  selectedActivity: Activity;
  onSubmit: (data: { activityId: string; datetime: Date; quantity: number }) => void;
}

export function ActivityLoggerPopover({
  open,
  onClose,
  selectedActivity,
  onSubmit,
}: ActivityLoggerPopoverProps) {
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(now);
  const [quantity, setQuantity] = useState<number>(0);
  const [time, setTime] = useState({
    hour: now.getHours().toString().padStart(2, '0'),
    minute: now.getMinutes().toString().padStart(2, '0'),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Generate hours and minutes options
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

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
      // Combine selected date with selected time
      const datetime = new Date(selectedDate);
      datetime.setHours(parseInt(time.hour), parseInt(time.minute), 0, 0);

      console.log({ datetime });
      onSubmit({
        activityId: selectedActivity.id,
        datetime,
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
                setSelectedDate(date);
              }
            }}
            className="rounded-md border mx-auto"
            disableFutureDates={true}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-center">
            Select Time
          </h3>
          <div className="max-w-xs mx-auto">
            <div className="flex items-center justify-center gap-2 text-lg font-medium mb-2">
              <span>{time.hour}:{time.minute}</span>
            </div>
            <Picker
              value={time}
              onChange={setTime}
              wheelMode="normal"
              height={180}
            >
              <Picker.Column name="hour">
                {hours.map(hour => (
                  <Picker.Item key={hour} value={hour}>
                    {hour}
                  </Picker.Item>
                ))}
              </Picker.Column>
              <Picker.Column name="minute">
                {minutes.map(minute => (
                  <Picker.Item key={minute} value={minute}>
                    {minute}
                  </Picker.Item>
                ))}
              </Picker.Column>
            </Picker>
          </div>
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
