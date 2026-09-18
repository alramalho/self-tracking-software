import { z } from "zod/v4";

export const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Use a valid date",
  );
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const timezone = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Use a valid timezone");
export const resourceUrl = z
  .string()
  .max(2000)
  .url()
  .refine((v) => new URL(v).protocol === "https:", "Use an HTTPS link")
  .nullable();
export const preferencesSchema = z.object({
  coaching: z.boolean(),
  reminder: z.boolean(),
  reminderMinutes: z.number().int().min(0).max(1440),
  dayReminderTime: time,
  checkIn: z.boolean(),
  checkInTime: time,
  weeklyReview: z.boolean(),
  reviewDay: z.number().int().min(0).max(6),
  reviewTime: time,
});
export const supportSchema = z
  .object({
    planId: z.string().min(1).max(200),
    mode: z.enum(["WEEKLY", "DAYS", "TIMED"]),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    time: time.nullable(),
    timezone,
    durationMinutes: z.number().int().min(1).max(1440),
    format: z.enum(["LOG", "TIMER", "RESOURCE"]),
    resourceUrl,
    resourceName: z.string().max(120).nullable(),
    nextStep: z.string().max(2000),
    preferences: preferencesSchema,
    effectiveDate: dateKey,
  })
  .superRefine((v, ctx) => {
    if (v.mode !== "WEEKLY" && !v.weekdays.length)
      ctx.addIssue({
        code: "custom",
        message: "Choose at least one day",
        path: ["weekdays"],
      });
    if (v.mode === "TIMED" && !v.time)
      ctx.addIssue({
        code: "custom",
        message: "Choose a session time",
        path: ["time"],
      });
    if (v.mode !== "TIMED" && v.time)
      ctx.addIssue({
        code: "custom",
        message: "Only timed sessions have a fixed time",
        path: ["time"],
      });
    if (new Set(v.weekdays).size !== v.weekdays.length)
      ctx.addIssue({
        code: "custom",
        message: "Days must be unique",
        path: ["weekdays"],
      });
  });
