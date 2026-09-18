import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { useReducedMotion } from "react-native-reanimated";
import { format } from "date-fns";
import {
  activityTotals,
  journeyData,
  photoUrl,
  yearEntries,
  yearMetrics,
} from "../model";
import { StoryPanel, StoryText, useStoryColors } from "../ui";
import { PhotoPreview } from "../PhotoPreview";
import type { ActivityEntry } from "@/core/types";
import type { StoryProps } from "../types";
export function Journey({ data }: StoryProps) {
  const c = useStoryColors();
  const reduced = useReducedMotion();
  const entries = useMemo(() => yearEntries(data.entries, data.year), [data]);
  const metrics = useMemo(() => yearMetrics(data.metrics, data.year), [data]);
  const graph = useMemo(
    () => journeyData(entries, metrics, data.activities),
    [entries, metrics, data.activities],
  );
  const [progress, setProgress] = useState(reduced ? 1 : 0);
  const [paused, setPaused] = useState(false);
  const [replay, setReplay] = useState(0);
  const [photo, setPhoto] = useState<ActivityEntry>();
  const [failed, setFailed] = useState<string[]>([]);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  useEffect(() => {
    if (reduced || paused || photo || !graph.days.length) return;
    let frame: number;
    const from = progressRef.current;
    const started = Date.now();
    let last = 0;
    const animate = () => {
      const now = Date.now();
      const value = Math.min(1, from + (now - started) / 32000);
      if (now - last > 32 || value === 1) {
        setProgress(value);
        last = now;
      }
      if (value < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [reduced, paused, photo, graph, replay]);
  const day = Math.min(
    graph.days.length - 1,
    27 + progress * Math.max(0, graph.days.length - 28),
  );
  const windowStart = Math.max(0, day - 28);
  const current = graph.days[Math.max(0, Math.floor(day))];
  const lines = graph.lines.map((l) => ({
    ...l,
    points: l.points.filter(
      (p) => p.day >= windowStart - 1 && p.day <= day + 1,
    ),
  }));
  const max = Math.max(
    1,
    ...lines.flatMap((l) => l.points.map((p) => p.value)),
  );
  const photos = graph.photos
    .filter((p) => p.day <= day && !failed.includes(p.entry.id))
    .slice(-3)
    .reverse();
  const segments = Math.max(1, Math.ceil((graph.days.length - 28) / 14));
  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <StoryText title style={{ flexShrink: 1 }}>
          {data.year} Journey
        </StoryText>
        {metrics.length > 0 && (
          <View style={{ alignItems: "flex-end" }}>
            <StoryText size={24}>
              {(
                metrics.reduce((s, e) => s + e.rating, 0) / metrics.length
              ).toFixed(1)}
            </StoryText>
            <StoryText muted size={11}>
              avg mood
            </StoryText>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {activityTotals(entries, data.activities)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((t) => (
            <StoryPanel
              key={t.activity.id}
              style={{
                borderRadius: 30,
                paddingVertical: 6,
                paddingHorizontal: 12,
              }}
            >
              <StoryText>
                {t.activity.emoji} ×{t.count}
              </StoryText>
            </StoryPanel>
          ))}
        <StoryText muted>{entries.length} entries</StoryText>
      </View>
      {graph.days.length < 7 ? (
        <StoryText muted>
          More activity over time will reveal your journey.
        </StoryText>
      ) : (
        <StoryPanel>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <StoryText muted size={12}>
              Your journey
            </StoryText>
            <StoryText size={12}>
              {current ? format(current, "MMM").toUpperCase() : ""} · Week{" "}
              {current ? Math.ceil(current.getDate() / 7) : 1}
            </StoryText>
          </View>
          <View style={{ height: 180 }}>
            <Svg
              width="100%"
              height={180}
              viewBox="0 0 115 100"
              preserveAspectRatio="none"
            >
              {[25, 50, 75].map((y) => (
                <Line
                  key={y}
                  x1={0}
                  x2={100}
                  y1={y}
                  y2={y}
                  stroke={c.border}
                  strokeWidth={0.5}
                />
              ))}
              {lines.map((l) => {
                const points = l.points.map((p) => ({
                  x: ((p.day - windowStart) / 28) * 100,
                  y: 85 - (p.value / max) * 70,
                }));
                const d = points
                  .map((p, i) =>
                    i
                      ? `C ${(points[i - 1].x + p.x) / 2} ${points[i - 1].y}, ${(points[i - 1].x + p.x) / 2} ${p.y}, ${p.x} ${p.y}`
                      : `M ${p.x} ${p.y}`,
                  )
                  .join(" ");
                return (
                  <Path
                    key={l.id}
                    d={d}
                    fill="none"
                    stroke={l.id === "mood" ? c.text : l.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                );
              })}
            </Svg>
            {lines.map((l) => {
              const end = l.points.at(-1);
              if (!end) return null;
              return (
                <View
                  key={l.id}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: `${Math.max(0, Math.min(90, 85 - (end.value / max) * 70))}%`,
                    flexDirection: "row",
                    gap: 4,
                  }}
                >
                  <StoryText>{l.emoji}</StoryText>
                  <StoryText
                    size={12}
                    style={{ color: l.id === "mood" ? c.text : l.color }}
                  >
                    {l.id === "mood"
                      ? end.value.toFixed(1)
                      : Math.round(end.value)}
                  </StoryText>
                </View>
              );
            })}
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 2,
              justifyContent: "center",
            }}
          >
            {Array.from({ length: segments }, (_, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Journey segment ${i + 1}`}
                onPress={() => {
                  setPaused(true);
                  setProgress(
                    Math.min(1, (i * 14) / Math.max(1, graph.days.length - 28)),
                  );
                }}
                style={{
                  minWidth: 22,
                  minHeight: 32,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width:
                      i ===
                      Math.min(
                        segments - 1,
                        Math.floor(
                          (progress * Math.max(0, graph.days.length - 28)) / 14,
                        ),
                      )
                        ? 20
                        : 8,
                    height: 8,
                    borderRadius: 8,
                    backgroundColor: c.muted,
                  }}
                />
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (progress >= 1) {
                setProgress(0);
                progressRef.current = 0;
                setPaused(false);
                setReplay((v) => v + 1);
              } else setPaused((v) => !v);
            }}
          >
            <StoryText muted size={12}>
              {progress >= 1
                ? "Replay journey"
                : paused
                  ? "Play journey"
                  : "Pause journey"}
            </StoryText>
          </Pressable>
          <View style={{ gap: 10 }}>
            {photos.map(({ entry }, i) => (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                accessibilityLabel={`Open memory ${entry.id}`}
                onPress={() => setPhoto(entry)}
              >
                <Image
                  source={{ uri: photoUrl(entry) }}
                  onError={() => setFailed((v) => [...v, entry.id])}
                  style={{
                    width: "100%",
                    height: i === 0 ? 220 : 96,
                    borderRadius: 12,
                  }}
                />
                <StoryText muted size={11} style={{ marginTop: 4 }}>
                  {format(new Date(entry.datetime), "MMM d")} ·{" "}
                  {
                    data.activities.find((a) => a.id === entry.activityId)
                      ?.emoji
                  }{" "}
                  {entry.description}
                </StoryText>
              </Pressable>
            ))}
          </View>
        </StoryPanel>
      )}
      <PhotoPreview
        entry={photo}
        activity={data.activities.find((a) => a.id === photo?.activityId)}
        onClose={() => setPhoto(undefined)}
      />
    </>
  );
}
