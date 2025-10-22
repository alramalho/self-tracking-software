import { Progress } from "@/components/ui/progress";
import { useState } from "react";

interface CorrelationEntryProps {
  title: string;
  pearsonValue: number; // between -1 and 1
  sampleSize: number; // number of entries used for correlation
  onReliabilityClick?: () => void;
}

type StrengthLevel = "impossible" | "weak" | "medium" | "strong";

const getStrength = (sampleSize: number): StrengthLevel => {
  if (sampleSize < 5) return "impossible";
  if (sampleSize < 15) return "weak";
  if (sampleSize < 30) return "medium";
  return "strong";
};

const strengthConfig = {
  impossible: {
    dot: "bg-gray-300",
    label: "Insufficient",
    labelColor: "text-gray-500"
  },
  weak: {
    dot: "bg-orange-400",
    label: "Weak",
    labelColor: "text-orange-600"
  },
  medium: {
    dot: "bg-blue-400",
    label: "Medium",
    labelColor: "text-blue-600"
  },
  strong: {
    dot: "bg-purple-500",
    label: "Confident",
    labelColor: "text-purple-600"
  },
};

export function CorrelationEntry({ title, pearsonValue, sampleSize, onReliabilityClick }: CorrelationEntryProps) {
  const isPositive = pearsonValue >= 0;
  const absoluteValue = Math.abs(pearsonValue);
  const percentage = absoluteValue * 100;
  const isWeak = percentage < 10;
  const color = isWeak ? "bg-gray-400" : (isPositive ? "bg-green-500" : "bg-red-500");
  const sign = isPositive ? "+ " : "– ";

  const strength = getStrength(sampleSize);
  const strengthStyle = strengthConfig[strength];

  const isInsufficient = strength === "impossible";

  return (
    <div className={`space-y-2 ${isInsufficient ? "opacity-40" : ""}`}>
      <div className="flex justify-between items-center text-sm gap-3">
        <div className="flex items-center gap-2 flex-1">
          <span>{title}</span>
          <button
            onClick={onReliabilityClick}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <div className={`w-2 h-2 rounded-full ${strengthStyle.dot}`} />
            <span className={`text-xs font-medium ${strengthStyle.labelColor}`}>
              {strengthStyle.label}
            </span>
          </button>
        </div>
        <span className={`font-medium ${isWeak ? "text-gray-400" : (isPositive ? "text-green-500" : "text-red-500")}`}>
          {sign}{percentage.toFixed(0)}%
        </span>
      </div>
      <Progress value={percentage} indicatorColor={color} />
    </div>
  );
}
