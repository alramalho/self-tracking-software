export interface SearchablePerson {
  username?: string | null;
  name?: string | null;
  activityCount?: number;
  lastActivityAt?: Date | string | null;
}

export interface PersonActivity {
  activityCount: number;
  lastActivityAt: Date | null;
}

export type PersonWithActivity<T> = T & PersonActivity;
