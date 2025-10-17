import { Construction } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface MaintenanceOverlayProps {
  targetDate?: Date;
}

export function MaintenanceOverlay({ targetDate }: MaintenanceOverlayProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Use provided targetDate or fall back to env var
  const maintenanceEndDate = useMemo(() => 
    targetDate || new Date(import.meta.env.VITE_MAINTENANCE_END_DATE || '2025-10-10T00:00:00Z'),
    [targetDate]
  );

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = maintenanceEndDate.getTime();
      const difference = target - now;

      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ hours, minutes, seconds });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      }
    };

    // Calculate immediately
    calculateTimeLeft();

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [maintenanceEndDate]);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-muted via-muted/80 to-muted flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-card rounded-3xl shadow-2xl p-8 md:p-12 text-center space-y-6">
        {/* Icon */}
        <Construction size={72} className="text-foreground mx-auto" />

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            We're Upgrading!
          </h1>
          <p className="text-lg text-muted-foreground">
            Our app is currently undergoing a migration to serve you better.
          </p>
        </div>

        {/* Countdown Timer */}
        <div className="py-4">
          <p className="text-sm uppercase tracking-wider mb-4 text-muted-foreground">
            Back online in
          </p>
          <div className="flex justify-center gap-4">
            <div className="flex flex-col items-center">
              <span className="text-5xl font-bold text-foreground">
                {String(timeLeft.hours).padStart(2, "0")}
              </span>
              <span className="text-xs mt-2 uppercase tracking-wider text-muted-foreground">
                Hours
              </span>
            </div>
            <div className="flex items-center text-4xl font-bold text-muted-foreground pb-8">:</div>
            <div className="flex flex-col items-center">
              <span className="text-5xl font-bold text-foreground">
                {String(timeLeft.minutes).padStart(2, "0")}
              </span>
              <span className="text-xs mt-2 uppercase tracking-wider text-muted-foreground">
                Minutes
              </span>
            </div>
            <div className="flex items-center text-4xl font-bold text-muted-foreground pb-8">:</div>
            <div className="flex flex-col items-center">
              <span className="text-5xl font-bold text-foreground">
                {String(timeLeft.seconds).padStart(2, "0")}
              </span>
              <span className="text-xs mt-2 uppercase tracking-wider text-muted-foreground">
                Seconds
              </span>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3 text-muted-foreground">
          <p className="text-base">
            We're working hard to complete this migration as quickly as possible.
          </p>
          <p className="text-sm">
            Thank you for your patience and understanding!
          </p>
        </div>
      </div>
    </div>
  );
}
