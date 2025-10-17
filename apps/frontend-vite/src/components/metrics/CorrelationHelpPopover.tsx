import React from "react";
import AppleLikePopover from "@/components/AppleLikePopover";

const ratingColors = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-lime-500",
  5: "text-green-500",
} as const;

interface CorrelationHelpPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  metricTitle: string;
}

export function CorrelationHelpPopover({
  isOpen,
  onClose,
  metricTitle,
}: CorrelationHelpPopoverProps) {
  return (
    <AppleLikePopover
      open={isOpen}
      onClose={onClose}
      title="Understanding Correlation"
    >
      <div className="pt-8 space-y-4 mb-4">
        <h3 className="text-lg font-semibold">Understanding Pearson Correlation</h3>

        <p className="text-sm text-muted-foreground">
          Pearson correlation measures how well two things move together, from -100%
          (perfect opposite) to +100% (perfect match).
        </p>

        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm font-medium mb-2">Real Example:</p>
          <p className="text-sm text-muted-foreground mb-3">
            Let&apos;s look at running activity and {metricTitle.toLowerCase()} over 7
            days:
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <th className="text-left pb-2 pr-4">Day</th>
                  <td className="px-3">1</td>
                  <td className="px-3">2</td>
                  <td className="px-3">3</td>
                  <td className="px-3">4</td>
                  <td className="px-3">5</td>
                  <td className="px-3">6</td>
                  <td className="px-3">7</td>
                </tr>
                <tr>
                  <th className="text-left py-2 pr-4">Running</th>
                  <td className="px-3">✅</td>
                  <td className="px-3">❌</td>
                  <td className="px-3">✅</td>
                  <td className="px-3">✅</td>
                  <td className="px-3">❌</td>
                  <td className="px-3">✅</td>
                  <td className="px-3">❌</td>
                </tr>
                <tr>
                  <th className="text-left py-2 pr-4">{metricTitle}</th>
                  <td className={`px-3 font-medium ${ratingColors[4]}`}>4</td>
                  <td className={`px-3 font-medium ${ratingColors[2]}`}>2</td>
                  <td className={`px-3 font-medium ${ratingColors[5]}`}>5</td>
                  <td className={`px-3 font-medium ${ratingColors[2]}`}>2</td>
                  <td className={`px-3 font-medium ${ratingColors[2]}`}>2</td>
                  <td className={`px-3 font-medium ${ratingColors[4]}`}>4</td>
                  <td className={`px-3 font-medium ${ratingColors[4]}`}>4</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm">
            A correlation of +60% means that about 60% of the time, when one value
            goes up, the other goes up too. Looking at the pattern above:
          </p>
          <ul className="mt-2 text-sm space-y-1 ml-4 list-disc">
            <li>
              Running days usually mean higher {metricTitle.toLowerCase()} (
              <span className={ratingColors[4]}>4</span>-
              <span className={ratingColors[5]}>5</span>), but not always
            </li>
            <li>
              Non-running days usually mean lower {metricTitle.toLowerCase()} (
              <span className={ratingColors[2]}>2</span>), but not always
            </li>
            <li>
              The pattern matches about 60% of the time (4 out of 7 days follow the
              expected pattern)
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Think of it like this: if you see someone went running, you&apos;d have
            a 60% chance of correctly guessing they had higher{" "}
            {metricTitle.toLowerCase()} that day - better than random chance, but
            not a guarantee.
          </p>
        </div>

        <div className="text-xs text-muted-foreground mt-4">
          Note: Correlations below 10% are shown in gray as they would only let you
          make correct predictions 10% of the time - barely better than random
          chance.
        </div>
      </div>
    </AppleLikePopover>
  );
}
