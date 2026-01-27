import { type MetricEntry } from "@tsw/prisma";
import React from "react";
import { MiniMonthlyHeatmap } from "./MiniMonthlyHeatmap";

interface YearMoodGridProps {
  entries: MetricEntry[];
  year: number;
  title?: string;
}

export const YearMoodGrid: React.FC<YearMoodGridProps> = ({
  entries,
  year,
  title = "What was my mood everyday?",
}) => {
  // Generate months 0-11
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="w-full">
      {/* Section title */}
      <h3 className="text-lg font-semibold mb-4">{title}</h3>

      {/* 3-column grid of mini heatmaps */}
      <div className="grid grid-cols-3 gap-4">
        {months.map((month) => (
          <MiniMonthlyHeatmap
            key={month}
            entries={entries}
            year={year}
            month={month}
          />
        ))}
      </div>
    </div>
  );
};

export default YearMoodGrid;
