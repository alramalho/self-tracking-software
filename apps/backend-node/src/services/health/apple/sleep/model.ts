import type {
  SleepInterval,
  SleepNight,
  SleepSample,
  SleepScore,
} from "./types";

const MINUTE = 60_000;
export const SLEEP_ALGORITHM = "tracking-sleep-v0";
export const SLEEP_TARGET_MINUTES = 480;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const clockDistance = (a: number, b: number) =>
  Math.min(Math.abs(a - b), 1440 - Math.abs(a - b));

function validTimezone(timezone: string | null): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone ?? "UTC" }).format();
    return timezone ?? "UTC";
  } catch {
    return "UTC";
  }
}

function nightFromSamples(samples: SleepSample[]): SleepNight | null {
  const asleep = samples.filter((sample) => sample.stage.startsWith("asleep_"));
  if (!asleep.length) return null;
  const start = Math.min(...asleep.map((sample) => sample.startAt.getTime()));
  const end = Math.max(...asleep.map((sample) => sample.endAt.getTime()));
  const points = [
    ...new Set(
      samples.flatMap((sample) => [
        Math.max(start, Math.min(end, sample.startAt.getTime())),
        Math.max(start, Math.min(end, sample.endAt.getTime())),
      ]),
    ),
  ].sort((a, b) => a - b);
  const intervals: SleepInterval[] = [];
  for (let i = 1; i < points.length; i++) {
    const left = points[i - 1],
      right = points[i];
    const covering = samples.filter(
      (sample) =>
        sample.startAt.getTime() < right && sample.endAt.getTime() > left,
    );
    if (!covering.length) continue;
    const awake = covering.some((sample) => sample.stage === "awake");
    const previous = intervals.at(-1);
    if (previous && previous.end === left && previous.awake === awake)
      previous.end = right;
    else intervals.push({ start: left, end: right, awake });
  }
  const minutes = (awake: boolean) =>
    intervals
      .filter((interval) => interval.awake === awake)
      .reduce(
        (sum, interval) => sum + (interval.end - interval.start) / MINUTE,
        0,
      );
  const asleepMinutes = minutes(false),
    awakeMinutes = minutes(true);
  if (asleepMinutes < 60 || end - start > 24 * 60 * MINUTE) return null;
  const timezone = validTimezone(asleep[0].timezone);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(end));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(start));
  const bedtimeMinutes =
    Number(parts.find((part) => part.type === "hour")?.value) * 60 +
    Number(parts.find((part) => part.type === "minute")?.value);
  const coverage = ((asleepMinutes + awakeMinutes) * MINUTE) / (end - start);
  return {
    date,
    startAt: new Date(start).toISOString(),
    endAt: new Date(end).toISOString(),
    timezone,
    sourceName: asleep[0].sourceName ?? "Apple Health",
    sourceBundleId: asleep[0].sourceBundleId,
    asleepMinutes,
    awakeMinutes,
    bedtimeMinutes,
    coverage,
    awakenings: intervals.filter(
      (interval) =>
        interval.awake && interval.end - interval.start >= 5 * MINUTE,
    ).length,
    continuityAvailable:
      coverage >= 0.95 &&
      samples.some((sample) =>
        ["asleep_core", "asleep_deep", "asleep_rem", "awake"].includes(
          sample.stage,
        ),
      ),
  };
}

export function sleepNights(samples: SleepSample[]): SleepNight[] {
  const sources = new Map<string, SleepSample[]>();
  for (const sample of samples) {
    if (
      ![
        "awake",
        "asleep_unspecified",
        "asleep_core",
        "asleep_deep",
        "asleep_rem",
      ].includes(sample.stage) ||
      !Number.isFinite(sample.startAt.getTime()) ||
      !Number.isFinite(sample.endAt.getTime()) ||
      sample.endAt <= sample.startAt
    )
      continue;
    const source = `${sample.sourceBundleId}:${sample.sourceProductType ?? ""}`;
    const list = sources.get(source) ?? [];
    list.push(sample);
    sources.set(source, list);
  }
  const nights: SleepNight[] = [];
  for (const values of sources.values()) {
    const sorted = [...values].sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime(),
    );
    let group: SleepSample[] = [],
      end = 0;
    for (const sample of sorted) {
      if (group.length && sample.startAt.getTime() - end > 90 * MINUTE) {
        const night = nightFromSamples(group);
        if (night) nights.push(night);
        group = [];
        end = 0;
      }
      group.push(sample);
      end = Math.max(end, sample.endAt.getTime());
    }
    const night = nightFromSamples(group);
    if (night) nights.push(night);
  }
  // One primary session/source per wake date; competing trackers never add up.
  const primary = new Map<string, SleepNight>();
  for (const night of nights.sort((a, b) =>
    a.sourceBundleId.localeCompare(b.sourceBundleId),
  )) {
    const existing = primary.get(night.date);
    if (!existing || night.asleepMinutes > existing.asleepMinutes)
      primary.set(night.date, night);
  }
  return [...primary.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function scoreSleep(
  samples: SleepSample[],
  now = new Date(),
): SleepScore[] {
  const nights = sleepNights(samples).filter(
    (night) => new Date(night.endAt).getTime() <= now.getTime() - 30 * MINUTE,
  );
  return nights.map((night, index) => {
    const previous = nights
      .slice(0, index)
      .filter(
        (item) =>
          item.coverage >= 0.95 &&
          item.timezone === night.timezone &&
          new Date(night.startAt).getTime() -
            new Date(item.startAt).getTime() <=
            21 * 86400_000,
      )
      .slice(-13);
    const baseline =
      previous.length >= 7
        ? [...previous].sort(
            (a, b) =>
              previous.reduce(
                (sum, item) =>
                  sum + clockDistance(a.bedtimeMinutes, item.bedtimeMinutes),
                0,
              ) -
              previous.reduce(
                (sum, item) =>
                  sum + clockDistance(b.bedtimeMinutes, item.bedtimeMinutes),
                0,
              ),
          )[0].bedtimeMinutes
        : null;
    const deviation =
      baseline === null ? null : clockDistance(night.bedtimeMinutes, baseline);
    const durationPoints = Math.round(
      50 * clamp(night.asleepMinutes / SLEEP_TARGET_MINUTES) ** 2,
    );
    const consistencyPoints =
      deviation === null ? null : Math.round(30 * clamp(1 - deviation / 180));
    const interruptionPoints = night.continuityAvailable
      ? Math.round(
          20 * clamp(1 - night.awakeMinutes / 90 - night.awakenings / 20),
        )
      : null;
    const status =
      night.coverage < 0.95 || !night.continuityAvailable
        ? "incomplete"
        : baseline === null
          ? "learning"
          : "ready";
    return {
      ...night,
      algorithm: SLEEP_ALGORITHM,
      targetMinutes: SLEEP_TARGET_MINUTES,
      durationPoints,
      consistencyPoints,
      interruptionPoints,
      baselineNights: previous.length,
      bedtimeDeviationMinutes: deviation,
      status,
      total:
        status === "ready"
          ? durationPoints + consistencyPoints! + interruptionPoints!
          : null,
    };
  });
}
