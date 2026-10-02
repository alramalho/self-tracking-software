// Every sentence the Metrics page says, kept apart from the screens so the
// wording can be read and tested in one place. A difference between two kinds
// of day is a pattern, not a cause: say "tends to" and "on X days", never
// "X gives you" or "X makes you".
import {
  CLEAR_DIFFERENCE,
  MIN_FINDING_DAYS,
  MIN_SLEEP_PAIRS,
  signalStrength,
} from "./model";
import type { SleepFinding } from "./model";
import type { ActivityFinding } from "./types";

export const CAVEAT =
  "It's a pattern, not proof. Something else on those days could explain it.";

const more = (count: number, word: string) =>
  `${count} more ${word}${count === 1 ? "" : "s"}`;
const counted = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

// "+18%", "−21%", "0%".
export function percent(difference: number) {
  const value = Math.round(Math.abs(difference) * 100);
  return value === 0 ? "0%" : `${difference > 0 ? "+" : "−"}${value}%`;
}

// What a row shows in place of a number while it is too early to give one.
export const waitingForActivity = (finding: ActivityFinding) =>
  finding.days < MIN_FINDING_DAYS
    ? more(MIN_FINDING_DAYS - finding.days, "day")
    : `${more(MIN_FINDING_DAYS - finding.otherDays, "day")} without`;
export const waitingForSleep = (sleep: SleepFinding) =>
  sleep.comparable
    ? "Not enough yet"
    : more(MIN_SLEEP_PAIRS - sleep.sampleSize, "night");

// The coach's one sentence at the top of the insights card.
export function headline(
  metricTitle: string,
  findings: ActivityFinding[],
  sleep?: SleepFinding | null,
) {
  const metric = metricTitle.toLowerCase();
  const measured = [
    ...findings.flatMap((finding) =>
      finding.difference === null
        ? []
        : [
            {
              difference: finding.difference,
              when: `on ${finding.activity.title} days`,
            },
          ],
    ),
    ...(sleep && sleep.difference !== null
      ? [{ difference: sleep.difference, when: "after a good night's sleep" }]
      : []),
  ];
  const clear = measured
    .filter((row) => Math.abs(row.difference) >= CLEAR_DIFFERENCE)
    .sort((a, b) => b.difference - a.difference);
  const up = clear.find((row) => row.difference > 0);
  const down = [...clear].reverse().find((row) => row.difference < 0);
  if (up && down)
    return `Your ${metric} tends to be higher ${up.when} and lower ${down.when}.`;
  if (up) return `Your ${metric} tends to be higher ${up.when}.`;
  if (down) return `Your ${metric} tends to be lower ${down.when}.`;
  if (measured.length)
    return `Nothing stands out yet. Your ${metric} looks much the same whatever you do that day.`;
  // Too early everywhere: name the row that is closest to having a number.
  const closest = findings[0];
  if (closest)
    return closest.days < MIN_FINDING_DAYS
      ? `Too early to say. Check in on ${more(MIN_FINDING_DAYS - closest.days, `${closest.activity.title} day`)} and I'll have something for you.`
      : `Too early to say. Check in on ${more(MIN_FINDING_DAYS - closest.otherDays, "day")} without ${closest.activity.title} and I'll have something for you.`;
  if (sleep && !sleep.comparable)
    return `Too early to say. Check in after ${more(MIN_SLEEP_PAIRS - sleep.sampleSize, "night")} and I'll know how sleep fits in.`;
  return `Log what you do on the days you check in and I'll tell you which habits go with higher ${metric}.`;
}

export const countUp = (checkIns: number) =>
  `${checkIns} of 7 check-ins. ${7 - checkIns} more and I can start looking for patterns.`;

// What the detail sheet says about one activity.
export function activityDetail(metricTitle: string, finding: ActivityFinding) {
  const { activity, days, otherDays } = finding;
  if (finding.difference !== null && finding.otherAverage !== null)
    return [
      `${metricTitle} averages ${finding.average.toFixed(1)} on ${activity.title} days and ${finding.otherAverage.toFixed(1)} on other days.`,
      `Based on ${counted(days, `${activity.title} day`)} and ${counted(otherDays, "other day")}.`,
    ];
  return days < MIN_FINDING_DAYS
    ? [
        `${counted(days, `${activity.title} day`)} with a check-in so far.`,
        `${more(MIN_FINDING_DAYS - days, "day")} and this row gets a number.`,
      ]
    : [
        `Nearly every check-in so far is on a ${activity.title} day.`,
        `${more(MIN_FINDING_DAYS - otherDays, "day")} without it and this row gets a number.`,
      ];
}

// "Signal 2 of 3. 7 more days for the next bar."
export function signalLine(
  count: number,
  unit: "day" | "night",
  first = MIN_FINDING_DAYS,
) {
  const next = [first, 15, 30].find((step) => count < step);
  const strength = `Signal ${signalStrength(count, first)} of 3.`;
  return next === undefined
    ? strength
    : `${strength} ${more(next - count, unit)} for the next bar.`;
}

export function trendLine(summary: {
  trend: number | null;
  currentAverage: number | null;
}) {
  if (summary.currentAverage === null) return "No check-ins this week yet";
  if (summary.trend === null) return "Nothing from last week to compare with";
  const size = Math.abs(summary.trend);
  if (size < 2) return "About the same as last week";
  const direction = summary.trend > 0 ? "higher" : "lower";
  return size < 10
    ? `A little ${direction} than last week`
    : `${direction === "higher" ? "Higher" : "Lower"} than last week`;
}

// Either side may be missing when only one weekday stands apart.
export function weekdayLine(best?: string, worst?: string) {
  if (best && worst) return `Highest on ${best}s, lowest on ${worst}s`;
  return best ? `Highest on ${best}s` : `Lowest on ${worst}s`;
}
