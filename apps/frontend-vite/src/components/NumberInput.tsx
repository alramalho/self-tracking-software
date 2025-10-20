import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import React from "react";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  tenIncrements?: boolean;
  title?: string;
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  tenIncrements = false,
  title,
}) => {
  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Main number input */}
      <div className="flex items-center justify-center space-x-2 max-w-xs mx-auto">
        {tenIncrements && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 rounded-full "
              onClick={() => onChange(Math.max(min, value - 10))}
              disabled={value <= min}
            >
              <Minus className="h-3 w-3" />
              <span className="">10</span>
            </Button>
            <span className="sr-only">Decrease by 10</span>
          </>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Minus className="h-4 w-4" />
          <span className="sr-only">Decrease</span>
        </Button>
        <div className="flex-1 text-center">
          <div className="text-4xl font-bold tracking-tighter">{value}</div>
          {title && (
            <div className="text-[0.70rem] uppercase text-muted-foreground">
              {title}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          <Plus data-testid="PLUS" className="h-4 w-4" />
          <span className="sr-only">Increase</span>
        </Button>
        {tenIncrements && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 rounded-full"
              onClick={() => onChange(Math.min(max, value + 10))}
              disabled={value >= max}
            >
              <Plus data-testid="PLUS" className="h-3 w-3" />10
            </Button>
            <span className="sr-only">Increase by 10</span>
          </>
        )}
      </div>

      {/* Ten increment buttons */}
    </div>
  );
};

export default NumberInput;
