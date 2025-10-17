import React from "react";
import AppleLikePopover from "@/components/AppleLikePopover";

const ratingColors = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-lime-500",
  5: "text-green-500",
} as const;

interface TrendHelpPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  metricTitle: string;
}

export function TrendHelpPopover({
  isOpen,
  onClose,
  metricTitle,
}: TrendHelpPopoverProps) {
  return (
    <AppleLikePopover
      open={isOpen}
      onClose={onClose}
      title="Understanding Trends"
    >
      <div className="pt-8 space-y-4 mb-4">
        <h3 className="text-lg font-semibold">
          Understanding Your {metricTitle} Trend
        </h3>

        <p className="text-sm text-muted-foreground">
          The trend compares your average {metricTitle.toLowerCase()} from this
          week against last week, showing how things are changing.
        </p>

        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm font-medium mb-2">Real Example:</p>
          <p className="text-sm text-muted-foreground mb-3">
            Let&apos;s look at someone&apos;s {metricTitle.toLowerCase()} ratings
            over two weeks:
          </p>
          <div className="space-y-6">
            {/* Last Week */}
            <div>
              <p className="text-sm font-medium mb-2">Last Week:</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <tbody>
                    <tr className="border-b">
                      <th className="text-left pb-2 pr-4">Day</th>
                      <td className="px-3">Mon</td>
                      <td className="px-3">Tue</td>
                      <td className="px-3">Wed</td>
                      <td className="px-3">Thu</td>
                      <td className="px-3">Fri</td>
                      <td className="px-3">Sat</td>
                      <td className="px-3">Sun</td>
                    </tr>
                    <tr>
                      <th className="text-left py-2 pr-4">Rating</th>
                      <td className={`px-3 font-medium ${ratingColors[2]}`}>2</td>
                      <td className={`px-3 font-medium ${ratingColors[3]}`}>3</td>
                      <td className={`px-3 font-medium ${ratingColors[2]}`}>2</td>
                      <td className={`px-3 font-medium ${ratingColors[3]}`}>3</td>
                      <td className={`px-3 font-medium ${ratingColors[3]}`}>3</td>
                      <td className={`px-3 font-medium ${ratingColors[2]}`}>2</td>
                      <td className={`px-3 font-medium ${ratingColors[3]}`}>3</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-sm mt-2">
                  Last week&apos;s average: <span className="font-medium">2.57</span>
                </p>
              </div>
            </div>

            {/* This Week */}
            <div>
              <p className="text-sm font-medium mb-2">This Week:</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <tbody>
                    <tr className="border-b">
                      <th className="text-left pb-2 pr-4">Day</th>
                      <td className="px-3">Mon</td>
                      <td className="px-3">Tue</td>
                      <td className="px-3">Wed</td>
                      <td className="px-3">Thu</td>
                      <td className="px-3">Fri</td>
                      <td className="px-3">Sat</td>
                      <td className="px-3">Sun</td>
                    </tr>
                    <tr>
                      <th className="text-left py-2 pr-4">Rating</th>
                      <td className={`px-3 font-medium ${ratingColors[3]}`}>3</td>
                      <td className={`px-3 font-medium ${ratingColors[4]}`}>4</td>
                      <td className={`px-3 font-medium ${ratingColors[4]}`}>4</td>
                      <td className={`px-3 font-medium ${ratingColors[5]}`}>5</td>
                      <td className={`px-3 font-medium ${ratingColors[4]}`}>4</td>
                      <td className={`px-3 font-medium ${ratingColors[4]}`}>4</td>
                      <td className={`px-3 font-medium ${ratingColors[4]}`}>4</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-sm mt-2">
                  This week&apos;s average: <span className="font-medium">4.00</span>
                </p>
              </div>
            </div>

            {/* Calculation */}
            <div className="mt-6 p-3 bg-card rounded border">
              <p className="text-sm font-medium mb-2">Trend Calculation:</p>
              <div className="space-y-2 text-sm">
                <p>1. This week&apos;s average: 4.00</p>
                <p>2. Last week&apos;s average: 2.57</p>
                <p>3. Calculation: ((4.00 - 2.57) / 2.57) × 100</p>
                <p className="font-medium text-green-500">
                  Result: +55.6% increase
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Understanding the Trend %:</p>
            <ul className="text-sm space-y-1 ml-4 list-disc">
              <li className="text-green-500">
                Positive % (↗️): This week&apos;s average is higher than last week
              </li>
              <li className="text-red-500">
                Negative % (↘️): This week&apos;s average is lower than last week
              </li>
              <li className="text-muted-foreground">
                The percentage shows how much better or worse this week is compared
                to last week
              </li>
            </ul>
          </div>
        </div>

        <div className="text-xs text-muted-foreground mt-4">
          Tip: Click on any dot to see the exact rating for that day.
        </div>
      </div>
    </AppleLikePopover>
  );
}
