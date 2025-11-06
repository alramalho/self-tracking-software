import AppleLikePopover from "@/components/AppleLikePopover";
import { CircleDashed } from "lucide-react";

interface ReliabilityHelpPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  sampleSize?: number;
}

const getReliabilityLevel = (size: number) => {
  if (size >= 30) return { level: "Confident", color: "purple", needed: 0 };
  if (size >= 15) return { level: "Medium", color: "blue", needed: 30 - size };
  if (size >= 5) return { level: "Weak", color: "orange", needed: 15 - size };
  return { level: "Insufficient", color: "gray", needed: 5 - size };
};

export function ReliabilityHelpPopover({
  isOpen,
  onClose,
  sampleSize,
}: ReliabilityHelpPopoverProps) {
  const reliability = sampleSize !== undefined ? getReliabilityLevel(sampleSize) : null;

  return (
    <AppleLikePopover open={isOpen} onClose={onClose} title="Data Reliability">
      <div className="p-6 space-y-4">
        {sampleSize !== undefined && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Data Points:</span>
              <span className="text-lg font-bold">{sampleSize}</span>
            </div>
            {reliability && reliability.needed > 0 && (
              <p className="text-xs text-muted-foreground">
                Log {reliability.needed} more time{reliability.needed !== 1 ? 's' : ''} to reach {
                  reliability.level === "Insufficient" ? "Weak" :
                  reliability.level === "Weak" ? "Medium" :
                  "Confident"
                } reliability
              </p>
            )}
            {reliability && reliability.needed === 0 && (
              <p className="text-xs text-green-600 font-medium">
                ✓ Maximum reliability achieved!
              </p>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          The reliability indicator shows how trustworthy each correlation is based on the amount of data available.
        </p>

        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-900 dark:text-blue-100">
            <strong>Important:</strong> Only activities logged <em>before</em> a metric entry are counted. This ensures correlations reflect actual cause-and-effect relationships.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-purple-600">Confident</div>
              <div className="text-xs text-muted-foreground">30+ data points - highly reliable</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-600">Medium</div>
              <div className="text-xs text-muted-foreground">15-29 data points - moderately reliable</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <div className="flex-1">
              <div className="text-sm font-medium text-orange-600">Weak</div>
              <div className="text-xs text-muted-foreground">5-14 data points - early indication</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CircleDashed className="w-3 h-3 text-gray-400" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-500">Insufficient</div>
              <div className="text-xs text-muted-foreground">&lt;5 data points - not enough data</div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground pt-2 border-t">
          Keep logging your metrics daily to improve reliability and discover more meaningful patterns!
        </p>
      </div>
    </AppleLikePopover>
  );
}
