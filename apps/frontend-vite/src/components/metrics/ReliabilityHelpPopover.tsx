import AppleLikePopover from "@/components/AppleLikePopover";

interface ReliabilityHelpPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReliabilityHelpPopover({
  isOpen,
  onClose,
}: ReliabilityHelpPopoverProps) {
  return (
    <AppleLikePopover open={isOpen} onClose={onClose} title="Data Reliability">
      <div className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          The reliability indicator shows how trustworthy each correlation is based on the amount of data available.
        </p>

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
            <div className="w-2 h-2 rounded-full bg-gray-300" />
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
