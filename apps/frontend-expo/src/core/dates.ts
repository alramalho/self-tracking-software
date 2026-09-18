import { format, parseISO } from "date-fns";
import type { DateValue } from "./types";
export const asDate = (value: DateValue) =>
  typeof value === "string" ? parseISO(value) : value;
export const dayKey = (value: DateValue) => format(asDate(value), "yyyy-MM-dd");
export const dateLabel = (value: DateValue) =>
  format(asDate(value), "MMM d, yyyy");
export const localDateTime = (value: DateValue) =>
  format(asDate(value), "yyyy-MM-dd'T'HH:mm");
export function parseLocalDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(
      value,
    )
  )
    throw new Error("Enter a valid date.");
  const date = parseISO(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Enter a valid date.");
  return date;
}
