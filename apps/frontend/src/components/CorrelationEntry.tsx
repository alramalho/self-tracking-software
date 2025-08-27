import { Progress } from "@/components/ui/progress";

interface CorrelationEntryProps {
  title: string;
  pearsonValue: number; // between -1 and 1
}

export function CorrelationEntry({ title, pearsonValue }: CorrelationEntryProps) {
  const isPositive = pearsonValue >= 0;
  const absoluteValue = Math.abs(pearsonValue);
  const percentage = absoluteValue * 100;
  const isWeak = percentage < 10;
  const color = isWeak ? "bg-gray-400" : (isPositive ? "bg-green-500" : "bg-red-500");
  const sign = isPositive ? "+ " : "– ";

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{title}</span>
        <span className={`font-medium ${isWeak ? "text-gray-400" : (isPositive ? "text-green-500" : "text-red-500")}`}>
          {sign}{percentage.toFixed(0)}%
        </span>
      </div>
      <Progress value={percentage} indicatorColor={color} />
    </div>
  );
} 