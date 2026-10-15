/**
 * When two activities are the same habit under different names ("Hike" and "Hiking").
 * The app runs this while a title is typed, the server runs it before asking Jev, so both
 * agree on the obvious cases instantly. Change the rule here and nowhere else.
 */
export type ActivityLike = {
  id: string;
  title: string;
  emoji: string;
  measure: string;
};

/** Logs of `activity` are multiplied by `factor` to count in `to` instead of `from`. */
export type MeasureConversion<T> = {
  activity: T;
  from: string;
  to: string;
  factor: number;
};

type Unit = { family: string; size: number };

// Words that carry no meaning for "is this the same habit".
const FILLER_WORDS = new Set(["a", "an", "the", "my", "some", "session", "sessions"]);

// Units whose logs convert exactly, by family. `size` is in the family's smallest unit, so
// converting the larger unit into the smaller one always gives whole numbers.
const UNITS: Record<string, Unit> = {
  second: { family: "time", size: 1 },
  minute: { family: "time", size: 60 },
  hour: { family: "time", size: 3600 },
  meter: { family: "metric distance", size: 1 },
  kilometer: { family: "metric distance", size: 1000 },
  foot: { family: "imperial distance", size: 1 },
  yard: { family: "imperial distance", size: 3 },
  mile: { family: "imperial distance", size: 5280 },
};

const MEASURE_ALIASES: Record<string, string> = {
  s: "second",
  sec: "second",
  secs: "second",
  seconds: "second",
  min: "minute",
  mins: "minute",
  minutes: "minute",
  h: "hour",
  hr: "hour",
  hrs: "hour",
  hours: "hour",
  meters: "meter",
  metre: "meter",
  metres: "meter",
  km: "kilometer",
  kms: "kilometer",
  kilometers: "kilometer",
  kilometre: "kilometer",
  kilometres: "kilometer",
  ft: "foot",
  feet: "foot",
  yd: "yard",
  yds: "yard",
  yards: "yard",
  mi: "mile",
  miles: "mile",
  times: "time",
  x: "time",
  session: "time",
  sessions: "time",
};

/** "Hiking" → "hik", "Hike" → "hik", "Swimming" → "swim", "Runs" → "run". */
function stem(word: string) {
  let base = word;
  if (base.length > 5 && base.endsWith("ing")) base = base.slice(0, -3);
  else if (base.length > 3 && base.endsWith("es")) base = base.slice(0, -2);
  else if (base.length > 3 && base.endsWith("s") && !base.endsWith("ss")) base = base.slice(0, -1);
  if (base.length > 3 && base.endsWith("e")) base = base.slice(0, -1);
  // "swimm" → "swim", "runn" → "run"
  if (base.length > 3 && base.at(-1) === base.at(-2)) base = base.slice(0, -1);
  return base;
}

/** The part of a title that names the habit, ignoring case, emoji, punctuation and word endings. */
export function activityNameKey(title: string) {
  return title
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter((word) => word && !FILLER_WORDS.has(word))
    .map(stem)
    .join(" ");
}

export function measureKey(measure: string) {
  const word = measure.trim().toLocaleLowerCase();
  return MEASURE_ALIASES[word] ?? word.replace(/s$/, "");
}

/**
 * What to multiply a quantity in `from` by to count it in `to`: 1 for the same measure,
 * 60 for hours into minutes. Undefined when there is no exact whole-number conversion
 * (minutes into hours, miles into kilometers, kilometers into minutes).
 */
export function conversionFactor(from: string, to: string) {
  const [fromKey, toKey] = [measureKey(from), measureKey(to)];
  if (fromKey === toKey) return 1;
  const [fromUnit, toUnit] = [UNITS[fromKey], UNITS[toKey]];
  if (!fromUnit || !toUnit || fromUnit.family !== toUnit.family) return undefined;
  return fromUnit.size % toUnit.size === 0 ? fromUnit.size / toUnit.size : undefined;
}

/** Logs add up when both count the same thing, or one converts exactly into the other. */
export function canCombine(a: Pick<ActivityLike, "measure">, b: Pick<ActivityLike, "measure">) {
  return (
    conversionFactor(a.measure, b.measure) !== undefined ||
    conversionFactor(b.measure, a.measure) !== undefined
  );
}

/**
 * How merging `remove` into `keep` lines up their measures. Both end up in the smaller unit
 * (hours become minutes, never the reverse), so every converted log stays a whole number.
 * `null`: same measure, nothing to convert. `undefined`: the logs can't be added up.
 */
export function mergeConversion<T extends Pick<ActivityLike, "measure">>(
  keep: T,
  remove: T,
): MeasureConversion<T> | null | undefined {
  const removeIntoKeep = conversionFactor(remove.measure, keep.measure);
  if (removeIntoKeep === 1) return null;
  if (removeIntoKeep)
    return { activity: remove, from: remove.measure, to: keep.measure, factor: removeIntoKeep };
  const keepIntoRemove = conversionFactor(keep.measure, remove.measure);
  if (keepIntoRemove)
    return { activity: keep, from: keep.measure, to: remove.measure, factor: keepIntoRemove };
  return undefined;
}

/** An existing activity whose name means the same habit as `title`, if any. */
export function findNameTwin<T extends ActivityLike>(
  title: string,
  activities: T[],
  excludeId?: string,
): T | undefined {
  const key = activityNameKey(title);
  if (key.length < 3) return undefined;
  return activities.find(
    (activity) => activity.id !== excludeId && activityNameKey(activity.title) === key,
  );
}

/** Merging keeps the activity with more logs; on a tie, the older one. */
export function chooseActivityToKeep<T extends { createdAt: Date | string; entryCount: number }>(
  a: T,
  b: T,
): [keep: T, remove: T] {
  if (a.entryCount !== b.entryCount) return a.entryCount > b.entryCount ? [a, b] : [b, a];
  return new Date(a.createdAt) <= new Date(b.createdAt) ? [a, b] : [b, a];
}
