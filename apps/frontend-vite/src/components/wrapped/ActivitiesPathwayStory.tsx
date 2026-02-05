import { useTheme } from "@/contexts/theme/useTheme";
import { timezoneToCountryCode, getCountryName } from "@/lib/timezoneToCountry";
import { type ActivityEntry, type Activity } from "@tsw/prisma";
import { motion, AnimatePresence } from "framer-motion";
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { format, startOfYear, endOfYear, differenceInDays, getWeek } from "date-fns";
import AppleLikePopover from "../AppleLikePopover";

interface ActivitiesPathwayStoryProps {
  year: number;
  activityEntries: ActivityEntry[];
  activities: Activity[];
}

interface PathwayEntry {
  entry: ActivityEntry;
  activity: Activity | undefined;
  dayOfYear: number;
  week: number;
  imageUrl: string | null;
  countryCode: string | null;
  countryName: string | null;
  isCountryChange: boolean;
  reactionCount: number;
}

const ANIMATION_DURATION = 15000; // 15 seconds
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MIN_DAYS_BETWEEN_IMAGES = 10; // At least ~1.5 weeks between images

// Convert ISO country code to flag emoji
const countryCodeToFlag = (code: string): string => {
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Construct public S3 URL from the path
const getPublicImageUrl = (entry: ActivityEntry): string | null => {
  if (entry.imageS3Path) {
    return `https://tracking-software-bucket-production.s3.eu-central-1.amazonaws.com/${entry.imageS3Path}`;
  }
  return entry.imageUrl || null;
};

export const ActivitiesPathwayStory: React.FC<ActivitiesPathwayStoryProps> = ({
  year,
  activityEntries,
  activities,
}) => {
  const { isLightMode } = useTheme();
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PathwayEntry | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const handleImageError = useCallback((entryId: string) => {
    setFailedImages((prev) => new Set(prev).add(entryId));
  }, []);

  // Process entries for the year
  const { pathwayEntries, totalDays } = useMemo(() => {
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 0, 1));
    const total = differenceInDays(yearEnd, yearStart) + 1;

    const yearEntries = activityEntries
      .filter((e) => new Date(e.datetime).getFullYear() === year)
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    let lastCountry: string | null = null;
    const entries: PathwayEntry[] = yearEntries.map((entry) => {
      const entryDate = new Date(entry.datetime);
      const dayOfYear = differenceInDays(entryDate, yearStart);
      const week = getWeek(entryDate, { weekStartsOn: 1 });
      const countryCode = timezoneToCountryCode(entry.timezone);
      const isCountryChange = countryCode !== null && countryCode !== lastCountry;
      if (countryCode) lastCountry = countryCode;

      return {
        entry,
        activity: activities.find((a) => a.id === entry.activityId),
        dayOfYear,
        week,
        imageUrl: getPublicImageUrl(entry),
        countryCode,
        countryName: countryCode ? getCountryName(countryCode) : null,
        isCountryChange,
        reactionCount: (entry as any).reactionCount || 0,
      };
    });

    return { pathwayEntries: entries, totalDays: total };
  }, [activityEntries, activities, year]);

  // Get spaced entries with images - prioritize by reaction count, ensure spacing
  const selectedEntries = useMemo(() => {
    const entriesWithImages = pathwayEntries
      .filter((e) => e.imageUrl && !failedImages.has(e.entry.id))
      .sort((a, b) => b.reactionCount - a.reactionCount); // Sort by reactions first

    const selected: PathwayEntry[] = [];

    for (const entry of entriesWithImages) {
      // Check if this entry is far enough from all already selected entries
      const isFarEnough = selected.every(
        (s) => Math.abs(s.dayOfYear - entry.dayOfYear) >= MIN_DAYS_BETWEEN_IMAGES
      );

      if (isFarEnough) {
        selected.push(entry);
      }
    }

    // Sort final selection by date
    return selected.sort((a, b) => a.dayOfYear - b.dayOfYear);
  }, [pathwayEntries, failedImages]);

  // Get country change markers
  const countryMarkers = useMemo(() => {
    return pathwayEntries.filter((e) => e.isCountryChange);
  }, [pathwayEntries]);

  // Start animation on mount
  useEffect(() => {
    const startDelay = setTimeout(() => {
      setIsAnimating(true);
      startTimeRef.current = null;
    }, 500);

    return () => clearTimeout(startDelay);
  }, []);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;

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
  }, [isAnimating]);

  // Current day based on progress
  const currentDay = Math.floor(progress * totalDays);
  const currentMonth = Math.floor((currentDay / totalDays) * 12);

  // Visible entries (revealed so far)
  const visibleEntries = selectedEntries.filter((e) => e.dayOfYear <= currentDay);
  const visibleMarkers = countryMarkers.filter((e) => e.dayOfYear <= currentDay);

  // Get position for a given day - vertical S-curve
  // x oscillates left-right, y goes down
  const getPositionForDay = (day: number) => {
    const t = day / totalDays;
    // x: oscillate between 20% and 80%, one full cycle per 2 months
    const x = 50 + Math.sin(t * Math.PI * 6) * 30;
    // y: linear from top to bottom (as percentage)
    const y = t * 100;
    return { x, y };
  };

  // Generate SVG path for the S-curve using smooth quadratic curves
  const generatePathD = () => {
    const points: Array<{ x: number; y: number }> = [];
    const steps = 200; // More steps for smoother curve

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = 50 + Math.sin(t * Math.PI * 6) * 30;
      const y = t * 100;
      points.push({ x, y });
    }

    // Build smooth path using quadratic bezier curves
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      // Use quadratic curve with control point at midpoint
      const cpX = (prev.x + curr.x) / 2;
      const cpY = (prev.y + curr.y) / 2;
      path += ` Q ${prev.x} ${prev.y} ${cpX} ${cpY}`;
    }
    // Final point
    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y}`;

    return path;
  };

  const pathD = generatePathD();

  return (
    <div
      className={`h-full flex flex-col overflow-hidden ${
        isLightMode
          ? "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
          : "bg-gradient-to-br from-amber-900 via-orange-900 to-rose-950"
      }`}
    >
      {/* Header */}
      <div className="p-4 pt-12 shrink-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🛤️</span>
            <h2 className="text-2xl font-bold text-white">Your Journey</h2>
          </div>
          <p className="text-white/70 text-sm">
            {selectedEntries.length} memories through {year}
          </p>
        </motion.div>

        {/* Current month indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex gap-1 mt-3 flex-wrap"
        >
          {MONTHS.map((month, idx) => (
            <div
              key={month}
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                idx <= currentMonth
                  ? "bg-white/30 text-white"
                  : "bg-white/10 text-white/40"
              }`}
            >
              {month}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Pathway visualization */}
      <div
        ref={containerRef}
        className="flex-1 relative mx-3 mb-3 rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm"
      >
        {/* SVG container that fills the space */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          {/* Background path */}
          <path
            d={pathD}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* Animated progress path */}
          <path
            d={pathD}
            fill="none"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="1000"
            strokeDashoffset={1000 - progress * 1000}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Month labels along the path */}
        {MONTHS.map((month, idx) => {
          const t = (idx + 0.5) / 12;
          const pos = getPositionForDay(t * totalDays);
          const isOnRight = Math.sin(t * Math.PI * 6) > 0;
          return (
            <div
              key={month}
              className="absolute text-white/50 text-[10px] font-medium pointer-events-none"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: `translate(${isOnRight ? '20px' : '-100%'}, -50%)`,
              }}
            >
              {month}
            </div>
          );
        })}

        {/* Country markers */}
        <AnimatePresence>
          {visibleMarkers.map((marker) => {
            const pos = getPositionForDay(marker.dayOfYear);
            return (
              <motion.div
                key={`country-${marker.entry.id}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute pointer-events-none z-20"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -150%)",
                }}
              >
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded-full">
                  <span className="text-[10px]">📍</span>
                  <span className="text-white text-[10px]">
                    {marker.countryCode && countryCodeToFlag(marker.countryCode)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Activity images along the path */}
        <AnimatePresence>
          {visibleEntries.map((item, idx) => {
            const pos = getPositionForDay(item.dayOfYear);
            return (
              <motion.div
                key={item.entry.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="absolute cursor-pointer z-10"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onClick={() => setSelectedEntry(item)}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg overflow-hidden ring-2 ring-white/50 shadow-lg">
                    <img
                      src={item.imageUrl!}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => handleImageError(item.entry.id)}
                    />
                  </div>
                  {item.activity && (
                    <span className="absolute -bottom-1 -right-1 text-xs bg-white/90 rounded-full w-4 h-4 flex items-center justify-center shadow">
                      {item.activity.emoji}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Traveler indicator */}
        {progress > 0 && progress < 1 && (
          <motion.div
            className="absolute pointer-events-none z-30"
            style={{
              left: `${getPositionForDay(currentDay).x}%`,
              top: `${getPositionForDay(currentDay).y}%`,
              transform: "translate(-50%, -50%)",
            }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <span className="text-xl">🚶</span>
          </motion.div>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-4 shrink-0">
        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white/60"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-white/50 text-[10px]">
          <span>Jan {year}</span>
          <span>Dec {year}</span>
        </div>
      </div>

      {/* Entry detail popover */}
      <AppleLikePopover
        open={selectedEntry !== null}
        onClose={() => setSelectedEntry(null)}
      >
        {selectedEntry && (
          <div className="p-4">
            {selectedEntry.imageUrl && (
              <div className="relative aspect-square rounded-xl overflow-hidden mb-4">
                <img
                  src={selectedEntry.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {selectedEntry.activity && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/40 backdrop-blur-sm rounded-full text-white text-sm">
                    <span>{selectedEntry.activity.emoji}</span>
                    <span>{selectedEntry.activity.title}</span>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {format(new Date(selectedEntry.entry.datetime), "MMMM d, yyyy")}
              </div>
              {selectedEntry.countryName && (
                <div className="flex items-center gap-2 text-sm">
                  <span>📍</span>
                  <span>
                    {selectedEntry.countryCode && countryCodeToFlag(selectedEntry.countryCode)}{" "}
                    {selectedEntry.countryName}
                  </span>
                </div>
              )}
              {selectedEntry.entry.description && (
                <p className="text-foreground">{selectedEntry.entry.description}</p>
              )}
            </div>
          </div>
        )}
      </AppleLikePopover>
    </div>
  );
};

export default ActivitiesPathwayStory;
