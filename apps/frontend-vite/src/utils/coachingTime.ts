/**
 * Utility functions for coaching time intervals
 */

export interface TimeInterval {
  startHour: number; // 0-22, even numbers only
  label: string; // e.g., "6-8am", "2-4pm"
  periodLabel: string; // e.g., "morning", "afternoon"
}

export const TIME_INTERVALS: TimeInterval[] = [
  { startHour: 0, label: "12-2am", periodLabel: "dawn" },
  { startHour: 2, label: "2-4am", periodLabel: "dawn" },
  { startHour: 4, label: "4-6am", periodLabel: "dawn" },
  { startHour: 6, label: "6-8am", periodLabel: "morning" },
  { startHour: 8, label: "8-10am", periodLabel: "morning" },
  { startHour: 10, label: "10am-12pm", periodLabel: "morning" },
  { startHour: 12, label: "12-2pm", periodLabel: "afternoon" },
  { startHour: 14, label: "2-4pm", periodLabel: "afternoon" },
  { startHour: 16, label: "4-6pm", periodLabel: "afternoon" },
  { startHour: 18, label: "6-8pm", periodLabel: "night" },
  { startHour: 20, label: "8-10pm", periodLabel: "night" },
  { startHour: 22, label: "10pm-12am", periodLabel: "night" },
];

export const TIME_PERIODS = [
  {
    label: "Dawn",
    intervals: TIME_INTERVALS.filter((i) => i.periodLabel === "dawn"),
  },
  {
    label: "Morning",
    intervals: TIME_INTERVALS.filter((i) => i.periodLabel === "morning"),
  },
  {
    label: "Afternoon",
    intervals: TIME_INTERVALS.filter((i) => i.periodLabel === "afternoon"),
  },
  {
    label: "Night",
    intervals: TIME_INTERVALS.filter((i) => i.periodLabel === "night"),
  },
];

/**
 * Get the time interval for a given start hour
 */
export function getTimeInterval(startHour: number): TimeInterval | undefined {
  return TIME_INTERVALS.find((i) => i.startHour === startHour);
}

/**
 * Get the period label for a given start hour
 */
export function getPeriodLabel(startHour: number): string {
  const interval = getTimeInterval(startHour);
  return interval?.periodLabel || "morning";
}

/**
 * Get the formatted label for a given start hour
 */
export function getFormattedLabel(startHour: number): string {
  const interval = getTimeInterval(startHour);
  return interval?.label || "6-8am";
}
