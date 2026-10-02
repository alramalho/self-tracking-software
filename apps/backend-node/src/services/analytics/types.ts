export interface ServerAnalyticsEvent {
  userId: string;
  event: "watch-used";
  properties?: Record<string, string | number | boolean>;
}
