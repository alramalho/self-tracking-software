export interface ExistingActivityContext {
  title: string;
  measure: string;
  entryCount: number;
  lastLoggedAt: string | null;
}

export interface InterviewContext {
  existingActivities: ExistingActivityContext[];
}
