import { useTheme } from "@/contexts/theme/useTheme";
import { timezoneToCountryCode, getCountryName } from "@/lib/timezoneToCountry";
import { motion, AnimatePresence } from "framer-motion";
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { eachDayOfInterval, startOfDay, format, differenceInDays } from "date-fns";
import type { ActivityEntry, MetricEntry, Activity } from "@tsw/prisma";

interface SeasonRunningGraphProps {
  metricEntries: MetricEntry[];
  activityEntries: ActivityEntry[];
  allActivityEntries: ActivityEntry[];
  activities: Activity[];
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
const ANIMATION_DURATION = 32000; // 32 seconds total
const MIN_DAYS_BETWEEN_IMAGES = 14;

const getPublicImageUrl = (entry: ActivityEntry): string | null => {
  if (entry.imageS3Path) {
    return `https://tracking-software-bucket-production.s3.eu-central-1.amazonaws.com/${entry.imageS3Path}`;
  }
  return entry.imageUrl || null;
};

interface ImageEntry {
  entryId: string;
  imageUrl: string;
  dayIndex: number;
  emoji: string;
  date: Date;
  location: string | null;
  countryCode: string | null;
  description: string | null;
  quantity: number;
  measure: string | null;
}

const countryCodeToFlag = (code: string): string => {
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export const SeasonRunningGraph: React.FC<SeasonRunningGraphProps> = ({
  metricEntries,
  activityEntries,
  allActivityEntries,
  activities,
  topActivities,
  animationDelay = 0,
}) => {
  const { isLightMode } = useTheme();
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [expandedImage, setExpandedImage] = useState<ImageEntry | null>(null);

  const handleImageError = useCallback((entryId: string) => {
    setFailedImages((prev) => new Set(prev).add(entryId));
  }, []);

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

    // Use 30-day rolling window for smoother monthly averages
    const ROLLING_WINDOW = 30;

    const getMoodAvg = (dayIdx: number): number | null => {
      let sum = 0;
      let count = 0;
      for (let i = Math.max(0, dayIdx - ROLLING_WINDOW + 1); i <= dayIdx; i++) {
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
      for (let i = Math.max(0, dayIdx - ROLLING_WINDOW + 1); i <= dayIdx; i++) {
        const dateKey = startOfDay(days[i]).toISOString();
        count += activityMap.get(dateKey) || 0;
      }
      return count;
    };

    const linesData: LineData[] = [];

    const moodPoints: LineData["allPoints"] = [];
    for (let i = ROLLING_WINDOW - 1; i < days.length; i++) {
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

  const selectedImages = useMemo(() => {
    if (allDays.length === 0) return [];

    const firstDate = allDays[0];

    const entriesWithImages = allActivityEntries
      .filter((e) => {
        const url = getPublicImageUrl(e);
        return url && !failedImages.has(e.id);
      })
      .map((e) => {
        const entryDate = new Date(e.datetime);
        const dayIndex = differenceInDays(startOfDay(entryDate), startOfDay(firstDate));
        const activity = activities.find((a) => a.id === e.activityId);
        return {
          entry: e,
          dayIndex,
          emoji: activity?.emoji || "📸",
          measure: activity?.measure || null,
          reactionCount: (e as any).reactions?.length || 0,
        };
      })
      .filter((e) => e.dayIndex >= 0 && e.dayIndex < allDays.length)
      .sort((a, b) => b.reactionCount - a.reactionCount);

    const selected: ImageEntry[] = [];
    for (const item of entriesWithImages) {
      const isFarEnough = selected.every(
        (s) => Math.abs(s.dayIndex - item.dayIndex) >= MIN_DAYS_BETWEEN_IMAGES
      );
      if (isFarEnough) {
        const countryCode = timezoneToCountryCode(item.entry.timezone);
        const countryName = countryCode ? getCountryName(countryCode) : null;
        selected.push({
          entryId: item.entry.id,
          imageUrl: getPublicImageUrl(item.entry)!,
          dayIndex: item.dayIndex,
          emoji: item.emoji,
          date: new Date(item.entry.datetime),
          location: countryName,
          countryCode,
          description: item.entry.description || null,
          quantity: item.entry.quantity,
          measure: item.measure,
        });
      }
    }

    return selected.sort((a, b) => a.dayIndex - b.dayIndex);
  }, [allActivityEntries, activities, allDays, failedImages]);

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

  const visibleImages = useMemo(() => {
    if (selectedImages.length === 0) return [];
    const passed = selectedImages.filter(img => img.dayIndex <= exactDayPosition);
    return passed.slice(-3).reverse();
  }, [selectedImages, exactDayPosition]);

  const newestImage = visibleImages[0] || null;

  // Bubble navigation: one bubble per 2-week segment
  const numSegments = Math.max(1, Math.ceil(animatableDays / 14));
  const currentSegment = Math.min(
    Math.floor((exactDayPosition - VISIBLE_DAYS) / 14),
    numSegments - 1
  );

  const handleBubbleClick = (segmentIndex: number) => {
    const targetProgress = Math.min((segmentIndex * 14) / animatableDays, 1);
    setProgress(targetProgress);
    // Adjust startTimeRef so animation continues from this position
    startTimeRef.current = performance.now() - targetProgress * ANIMATION_DURATION;
  };

  const handleImageClick = (e: React.MouseEvent, image: ImageEntry) => {
    e.stopPropagation();
    setExpandedImage(image);
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsAnimating(false);
  };

  const handleCloseExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedImage(null);
    startTimeRef.current = performance.now() - progress * ANIMATION_DURATION;
    setIsAnimating(true);
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full rounded-2xl p-4 flex flex-col ${isLightMode ? "bg-neutral-100" : "bg-white/5"}`}
    >
      {/* Header with month/week */}
      <div className="flex justify-between items-center mb-2">
        <h3 className={`text-xs font-medium ${isLightMode ? "text-neutral-400" : "text-white/70"}`}>
          Your journey
        </h3>
        <div className="text-right">
          <span className={`font-bold text-sm ${isLightMode ? "text-neutral-900" : "text-white"}`}>{monthLabel}</span>
          <span className={`text-xs ml-2 ${isLightMode ? "text-neutral-400" : "text-white/50"}`}>Week {weekOfMonth}</span>
        </div>
      </div>

      {/* Graph container */}
      <div className="relative shrink-0" style={{ height: 180 }}>
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

      {/* Bubble navigation */}
      <div className="flex items-center justify-center gap-1.5 mt-2 shrink-0">
        {Array.from({ length: numSegments }, (_, i) => {
          const isActive = i === currentSegment;
          const isPast = i < currentSegment;
          return (
            <button
              key={i}
              onClick={() => handleBubbleClick(i)}
              className={`rounded-full transition-all duration-300 ${
                isActive
                  ? "w-6 h-2.5 bg-white/70"
                  : isPast
                  ? "w-2.5 h-2.5 bg-white/40"
                  : "w-2.5 h-2.5 bg-white/15"
              }`}
            />
          );
        })}
      </div>

      {/* Image card area - vertical stack */}
      {visibleImages.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl relative" style={{ minHeight: 480 }}>
          <AnimatePresence initial={false}>
            {visibleImages.map((img, idx) => (
              <motion.div
                key={img.entryId}
                initial={{ top: "-34%", opacity: 0 }}
                animate={{ top: `${idx * 34}%`, opacity: 1 }}
                exit={{ top: "102%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="absolute left-0 right-0 rounded-xl overflow-hidden cursor-pointer ring-1 ring-white/20"
                style={{ height: "30%", minHeight: 140 }}
                onClick={(e) => handleImageClick(e, img)}
              >
                <img
                  src={img.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => handleImageError(img.entryId)}
                />
                <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{img.emoji}</span>
                    <span className="text-white/90 text-sm font-medium">
                      {img.quantity}{img.measure ? ` ${img.measure}` : ""} · {format(img.date, "MMM d")}
                    </span>
                  </div>
                  {img.countryCode && (
                    <span className="text-xl">{countryCodeToFlag(img.countryCode)}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Expanded image overlay */}
      {expandedImage && createPortal(
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={handleCloseExpanded}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative max-w-full max-h-full"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <img
              src={expandedImage.imageUrl}
              alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
            />
            {expandedImage.location && (
              <div className="text-white/80 text-sm mt-2 text-center flex items-center justify-center gap-1.5">
                <span>📍</span>
                <span>{expandedImage.location}</span>
              </div>
            )}
            {expandedImage.description && (
              <p className="text-white/70 text-xs mt-1 text-center">
                {expandedImage.description}
              </p>
            )}
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SeasonRunningGraph;
