import { motion } from "framer-motion";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { eachDayOfInterval, startOfDay, format } from "date-fns";
import type { ActivityEntry, MetricEntry, Activity } from "@tsw/prisma";

interface SeasonRunningGraphProps {
  metricEntries: MetricEntry[];
  activityEntries: ActivityEntry[];
  topActivities: Array<{ activity: Activity; count: number }>;
  animationDelay?: number;
}

interface LineData {
  id: string;
  emoji: string;
  color: string;
  allPoints: { dayIndex: number; value: number }[];
}

const COLORS = [
  "#f59e0b", // amber
  "#ec4899", // pink
  "#10b981", // emerald
  "#8b5cf6", // violet
];

const VISIBLE_DAYS = 28;
const ANIMATION_DURATION = 8000; // 8 seconds total

export const SeasonRunningGraph: React.FC<SeasonRunningGraphProps> = ({
  metricEntries,
  activityEntries,
  topActivities,
  animationDelay = 0,
}) => {
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const { lines, allDays, totalDays } = useMemo(() => {
    if (metricEntries.length === 0 && activityEntries.length === 0) {
      return { lines: [], allDays: [], totalDays: 0 };
    }

    const allDates: Date[] = [
      ...metricEntries.map((e) => new Date(e.createdAt)),
      ...activityEntries.map((e) => new Date(e.datetime)),
    ];

    if (allDates.length === 0) return { lines: [], allDays: [], totalDays: 0 };

    allDates.sort((a, b) => a.getTime() - b.getTime());
    const firstDate = startOfDay(allDates[0]);
    const lastDate = startOfDay(allDates[allDates.length - 1]);
    const days = eachDayOfInterval({ start: firstDate, end: lastDate });

    if (days.length < 7) return { lines: [], allDays: [], totalDays: 0 };

    const moodByDate = new Map<string, number[]>();
    metricEntries.forEach((entry) => {
      const dateKey = startOfDay(new Date(entry.createdAt)).toISOString();
      const existing = moodByDate.get(dateKey) || [];
      existing.push(entry.rating);
      moodByDate.set(dateKey, existing);
    });

    const activityMaps = new Map<string, Map<string, number>>();
    topActivities.slice(0, 3).forEach((item) => {
      const map = new Map<string, number>();
      activityEntries
        .filter((e) => e.activityId === item.activity.id)
        .forEach((entry) => {
          const dateKey = startOfDay(new Date(entry.datetime)).toISOString();
          map.set(dateKey, (map.get(dateKey) || 0) + 1);
        });
      activityMaps.set(item.activity.id, map);
    });

    const getMoodAvg = (dayIdx: number): number | null => {
      let sum = 0;
      let count = 0;
      for (let i = Math.max(0, dayIdx - 6); i <= dayIdx; i++) {
        const dateKey = startOfDay(days[i]).toISOString();
        const ratings = moodByDate.get(dateKey);
        if (ratings) {
          ratings.forEach((r) => {
            sum += r;
            count++;
          });
        }
      }
      return count > 0 ? sum / count : null;
    };

    const getActivityCount = (activityId: string, dayIdx: number): number => {
      const activityMap = activityMaps.get(activityId);
      if (!activityMap) return 0;
      let count = 0;
      for (let i = Math.max(0, dayIdx - 6); i <= dayIdx; i++) {
        const dateKey = startOfDay(days[i]).toISOString();
        count += activityMap.get(dateKey) || 0;
      }
      return count;
    };

    const linesData: LineData[] = [];

    const moodPoints: LineData["allPoints"] = [];
    for (let i = 6; i < days.length; i++) {
      const moodAvg = getMoodAvg(i);
      if (moodAvg !== null) {
        moodPoints.push({ dayIndex: i, value: moodAvg });
      }
    }
    if (moodPoints.length > 1) {
      linesData.push({
        id: "mood",
        emoji: "😊",
        color: "#000000",
        allPoints: moodPoints,
      });
    }

    topActivities.slice(0, 3).forEach((item, idx) => {
      const activityPoints: LineData["allPoints"] = [];
      for (let i = 6; i < days.length; i++) {
        const count = getActivityCount(item.activity.id, i);
        activityPoints.push({ dayIndex: i, value: count });
      }
      if (activityPoints.length > 1) {
        linesData.push({
          id: item.activity.id,
          emoji: item.activity.emoji || "📊",
          color: COLORS[idx % COLORS.length],
          allPoints: activityPoints,
        });
      }
    });

    return { lines: linesData, allDays: days, totalDays: days.length };
  }, [metricEntries, activityEntries, topActivities]);

  useEffect(() => {
    if (totalDays === 0) return;

    const startDelay = setTimeout(() => {
      setIsAnimating(true);
      startTimeRef.current = null;
    }, (animationDelay + 0.3) * 1000);

    return () => clearTimeout(startDelay);
  }, [totalDays, animationDelay]);

  useEffect(() => {
    if (!isAnimating || totalDays === 0) return;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const newProgress = Math.min(elapsed / ANIMATION_DURATION, 1);

      setProgress(newProgress);

      if (newProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, totalDays]);

  if (lines.length === 0 || totalDays < VISIBLE_DAYS) {
    return null;
  }

  // Calculate the exact fractional day position
  const animatableDays = totalDays - VISIBLE_DAYS;
  const exactDayPosition = VISIBLE_DAYS + progress * animatableDays;
  const currentDayIndex = Math.floor(exactDayPosition);
  const dayFraction = exactDayPosition - currentDayIndex;

  const currentDate = allDays[Math.min(currentDayIndex, totalDays - 1)];
  const monthLabel = format(currentDate, "MMM").toUpperCase();
  const weekOfMonth = Math.ceil(currentDate.getDate() / 7);

  // Window slides smoothly
  const exactWindowStart = Math.max(0, exactDayPosition - VISIBLE_DAYS);
  const windowStart = Math.floor(exactWindowStart);
  const windowEnd = currentDayIndex + 1; // Include the next point for interpolation

  // Get all values for normalization (include a bit ahead for stable scaling)
  const allVisibleValues: number[] = [];
  lines.forEach((line) => {
    line.allPoints.forEach((p) => {
      if (p.dayIndex >= windowStart && p.dayIndex <= windowEnd + 1) {
        allVisibleValues.push(p.value);
      }
    });
  });

  const minVal = Math.min(...allVisibleValues, 0);
  const maxVal = Math.max(...allVisibleValues, 1);
  const range = maxVal - minVal || 1;

  // Helper to convert day index to X coordinate with smooth sliding
  const dayToX = (dayIndex: number): number => {
    return ((dayIndex - exactWindowStart) / VISIBLE_DAYS) * 100;
  };

  // Helper to convert value to Y coordinate
  const valueToY = (value: number): number => {
    return 85 - ((value - minVal) / range) * 70;
  };

  // Create smoothly growing path for each line
  const createPath = (line: LineData): string => {
    // Get points that could be visible (including partial)
    const relevantPoints = line.allPoints.filter(
      (p) => p.dayIndex >= windowStart - 1 && p.dayIndex <= windowEnd
    );

    if (relevantPoints.length < 1) return "";

    // Build path points, cutting off at the exact current position
    const pathPoints: { x: number; y: number }[] = [];

    for (let i = 0; i < relevantPoints.length; i++) {
      const point = relevantPoints[i];
      const x = dayToX(point.dayIndex);

      // Skip points that are before the visible window
      if (x < -5) continue;

      // If this point is beyond our current animation position, interpolate
      if (point.dayIndex > exactDayPosition) {
        // Find the previous point to interpolate from
        if (pathPoints.length > 0 && i > 0) {
          const prevPoint = relevantPoints[i - 1];
          const prevX = dayToX(prevPoint.dayIndex);
          const prevY = valueToY(prevPoint.value);
          const nextX = x;
          const nextY = valueToY(point.value);

          // Calculate interpolation factor
          const segmentProgress =
            (exactDayPosition - prevPoint.dayIndex) /
            (point.dayIndex - prevPoint.dayIndex);

          // Interpolate X and Y
          const interpX = prevX + (nextX - prevX) * segmentProgress;
          const interpY = prevY + (nextY - prevY) * segmentProgress;

          pathPoints.push({ x: interpX, y: interpY });
        }
        break;
      }

      pathPoints.push({ x, y: valueToY(point.value) });
    }

    if (pathPoints.length < 2) return "";

    // Build smooth bezier path
    let path = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
    for (let i = 1; i < pathPoints.length; i++) {
      const prev = pathPoints[i - 1];
      const curr = pathPoints[i];
      const cpX = (prev.x + curr.x) / 2;
      path += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    return path;
  };

  // Get the interpolated end position for each line
  const getLineEndpoint = (
    line: LineData
  ): { x: number; y: number; value: number } | null => {
    const relevantPoints = line.allPoints.filter(
      (p) => p.dayIndex >= windowStart - 1 && p.dayIndex <= windowEnd
    );

    if (relevantPoints.length === 0) return null;

    // Find where we are in the animation
    let lastPoint = relevantPoints[0];
    let nextPoint: (typeof relevantPoints)[0] | null = null;

    for (let i = 0; i < relevantPoints.length; i++) {
      if (relevantPoints[i].dayIndex <= exactDayPosition) {
        lastPoint = relevantPoints[i];
        nextPoint = relevantPoints[i + 1] || null;
      } else {
        break;
      }
    }

    // If we have a next point, interpolate to it
    if (nextPoint && nextPoint.dayIndex > exactDayPosition) {
      const segmentProgress =
        (exactDayPosition - lastPoint.dayIndex) /
        (nextPoint.dayIndex - lastPoint.dayIndex);

      const x = dayToX(lastPoint.dayIndex) +
        (dayToX(nextPoint.dayIndex) - dayToX(lastPoint.dayIndex)) * segmentProgress;
      const y = valueToY(lastPoint.value) +
        (valueToY(nextPoint.value) - valueToY(lastPoint.value)) * segmentProgress;
      const value = lastPoint.value +
        (nextPoint.value - lastPoint.value) * segmentProgress;

      // Only show if within visible area
      if (x < 0 || x > 105) return null;

      return { x, y, value };
    }

    // Otherwise use the last point
    const x = dayToX(lastPoint.dayIndex);
    if (x < 0 || x > 105) return null;

    return {
      x,
      y: valueToY(lastPoint.value),
      value: lastPoint.value,
    };
  };

  return (
    <div
      ref={containerRef}
      className="w-full bg-white/10 backdrop-blur-sm rounded-2xl p-4"
    >
      {/* Header with month/week */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-white/70 text-xs font-medium">
          Your season journey
        </h3>
        <div className="text-right">
          <span className="text-white font-bold text-sm">{monthLabel}</span>
          <span className="text-white/50 text-xs ml-2">Week {weekOfMonth}</span>
        </div>
      </div>

      {/* Graph container */}
      <div className="relative" style={{ height: 180 }}>
        <svg
          viewBox="0 0 115 100"
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ overflow: "visible" }}
        >
          {/* Grid lines */}
          {[25, 50, 75].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.5"
            />
          ))}

          {/* Lines */}
          {lines.map((line) => (
            <path
              key={line.id}
              d={createPath(line)}
              fill="none"
              stroke={line.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>

        {/* Emoji + value labels at line tips */}
        {lines.map((line) => {
          const endpoint = getLineEndpoint(line);
          if (!endpoint) return null;

          return (
            <div
              key={`label-${line.id}`}
              className="absolute flex items-center gap-1 pointer-events-none"
              style={{
                left: `${(endpoint.x / 115) * 100}%`,
                top: `${endpoint.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <span className="text-base">{line.emoji}</span>
              <span
                className="text-xs font-medium"
                style={{
                  color: line.color === "#000000" ? "#fff" : line.color,
                }}
              >
                {line.id === "mood"
                  ? endpoint.value.toFixed(1)
                  : Math.round(endpoint.value)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress indicator */}
      <div className="h-0.5 bg-white/10 rounded-full overflow-hidden mt-2">
        <motion.div
          className="h-full bg-white/30"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
};

export default SeasonRunningGraph;
