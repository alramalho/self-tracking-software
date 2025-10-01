import { Progress } from "@/components/ui/progress";

interface CorrelationEntryProps {
  title: string;
  pearsonValue: number; // between -1 and 1
  sampleSize: number; // number of entries used for correlation
}

type StrengthLevel = "impossible" | "weak" | "medium" | "strong";

const getStrength = (sampleSize: number): StrengthLevel => {
  if (sampleSize < 5) return "impossible";
  if (sampleSize < 15) return "weak";
  if (sampleSize < 30) return "medium";
  return "strong";
};

const strengthConfig = {
  impossible: { dot: "bg-gray-300", opacity: "opacity-40" },
  weak: { dot: "bg-orange-400", opacity: "opacity-60" },
  medium: { dot: "bg-blue-400", opacity: "opacity-80" },
  strong: { dot: "bg-purple-500", opacity: "opacity-100" },
};

export function CorrelationEntry({ title, pearsonValue, sampleSize }: CorrelationEntryProps) {
  const isPositive = pearsonValue >= 0;
  const absoluteValue = Math.abs(pearsonValue);
  const percentage = absoluteValue * 100;
  const isWeak = percentage < 10;
  const color = isWeak ? "bg-gray-400" : (isPositive ? "bg-green-500" : "bg-red-500");
  const sign = isPositive ? "+ " : "– ";

  const strength = getStrength(sampleSize);
  const strengthStyle = strengthConfig[strength];

  return (
    <div className={`space-y-2 ${strengthStyle.opacity}`}>
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${strengthStyle.dot}`} />
          <span>{title}</span>
        </div>
        <span className={`font-medium ${isWeak ? "text-gray-400" : (isPositive ? "text-green-500" : "text-red-500")}`}>
          {sign}{percentage.toFixed(0)}%
        </span>
      </div>
      <Progress value={percentage} indicatorColor={color} />
    </div>
  );
}
