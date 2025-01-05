import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
}) => {
  return (
    <div className="flex items-center justify-center space-x-2 max-w-xs">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full bg-secondary text-primary-secondary"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Minus className="h-4 w-4" />
        <span className="sr-only">Decrease</span>
      </Button>
      <div className="flex-1 text-center">
        <div className="text-4xl font-bold tracking-tighter">
          {value}
        </div>
        <div className="text-[0.70rem] uppercase text-muted-foreground">
          Times per week
        </div>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Plus data-testid="plus" className="h-4 w-4" />
        <span className="sr-only">Increase</span>
      </Button>
    </div>
  );
};

export default NumberInput; 