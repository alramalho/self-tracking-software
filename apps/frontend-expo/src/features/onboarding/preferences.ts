import type { OnboardingDraft, SupportPreferences } from "@tsw/prisma/follow-through";

export function onboardingPreferences(draft: OnboardingDraft): SupportPreferences {
  return draft.preferences ?? {
    coaching: draft.wantsCoaching,
    reminder: false,
    reminderMinutes: 30,
    dayReminderTime: "09:00",
    checkIn: false,
    checkInTime: "10:00",
    weeklyReview: false,
    reviewDay: 0,
    reviewTime: "18:00",
  };
}
