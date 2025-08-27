import React from "react";

interface WeekMetricBarChartProps {
  data: number[];
  color:
    | "yellow"
    | "blue"
    | "green"
    | "rose"
    | "pink"
    | "red"
    | "orange"
    | "amber"
    | "purple"
    | "gray";
  className?: string;
}

const getColorsFromName = (colorName: string): { bg: string; text: string } => {
  const colorMap: { [key: string]: { bg: string; text: string } } = {
    blue: { bg: "bg-blue-200", text: "text-blue-700" },
    yellow: { bg: "bg-yellow-200", text: "text-yellow-700" },
    green: { bg: "bg-green-200", text: "text-green-700" },
    rose: { bg: "bg-rose-200", text: "text-rose-700" },
    pink: { bg: "bg-pink-200", text: "text-pink-700" },
    red: { bg: "bg-red-200", text: "text-red-700" },
    orange: { bg: "bg-orange-200", text: "text-orange-700" },
    amber: { bg: "bg-amber-200", text: "text-amber-700" },
    purple: { bg: "bg-purple-200", text: "text-purple-700" },
    gray: { bg: "bg-gray-200", text: "text-gray-700" },
  };

  return colorMap[colorName] || { bg: "bg-gray-200", text: "text-gray-700" };
};

export const WeekMetricBarChart: React.FC<WeekMetricBarChartProps> = ({
  data,
  color,
  className = "flex gap-1 mb-2 items-end",
}) => {
  const { bg, text } = getColorsFromName(color);

  return (
    <div className={className}>
      {data.map((value, i) => {
        if (value === 0) {
          // Special case for 0: show number above the chart area with no bar
          return (
            <div key={i} className="flex-1 relative">
              <div className="relative h-2 mt-6">
                {" "}
                {/* Small baseline height */}
                <span
                  className={`absolute -top-4 left-1/2 transform -translate-x-1/2 text-xs font-medium ${text} opacity-50`}
                >
                  N/A
                </span>
              </div>
              <div
                className={`${bg} rounded-sm relative`}
                style={{ height: `1px` }}
              />
            </div>
          );
        }

        // Normal case: show bar with number centered
        const height = value * 8;
        return (
          <div key={i} className="flex-1 relative">
            <div
              className={`${bg} rounded-sm relative`}
              style={{ height: `${height}px` }}
            >
              <span
                className={`absolute inset-0 flex items-center justify-center text-xs font-medium ${text}`}
              >
                {value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
