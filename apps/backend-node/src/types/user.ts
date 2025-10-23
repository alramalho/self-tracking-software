import { z } from 'zod';

export const TimezoneUpdateSchema = z.object({
  timezone: z.string(),
});

export const ThemeUpdateSchema = z.object({
  theme_base_color: z.enum(['RANDOM', 'SLATE', 'BLUE', 'VIOLET', 'AMBER', 'EMERALD', 'ROSE']),
});

export const DailyCheckinSettingsSchema = z.object({
  days: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])),
  time: z.enum(['MORNING', 'AFTERNOON', 'EVENING']).optional(),
});

export const FeedbackSchema = z.object({
  email: z.string().email(),
  text: z.string().min(1),
  type: z.enum(['bug_report', 'help_request', 'feature_request']),
});

export const FriendRequestSchema = z.object({
  message: z.string().optional(),
});

export const TestimonialFeedbackSchema = z.object({
  sentiment: z.number().min(1).max(4),
  message: z.string().min(1),
  wasRewritten: z.boolean().optional(),
});

export type TimezoneUpdate = z.infer<typeof TimezoneUpdateSchema>;
export type ThemeUpdate = z.infer<typeof ThemeUpdateSchema>;
export type DailyCheckinSettings = z.infer<typeof DailyCheckinSettingsSchema>;
export type Feedback = z.infer<typeof FeedbackSchema>;
export type FriendRequestData = z.infer<typeof FriendRequestSchema>;
export type TestimonialFeedback = z.infer<typeof TestimonialFeedbackSchema>;

export interface UserSearchResult {
  userId: string;
  username: string;
  name: string | null;
  picture: string | null;
}

export interface LoadUsersDataResponse {
  [username: string]: {
    user: any;
    activities: any[];
    activity_entries: any[];
    mood_reports: any[];
    plans: any[];
    plan_groups: any[];
    sent_friend_requests?: any[];
    received_friend_requests?: any[];
  };
}