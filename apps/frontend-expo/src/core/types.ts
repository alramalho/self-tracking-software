export type DateValue = Date | string;
export interface Person {
  id: string;
  name?: string | null;
  username?: string | null;
  picture?: string | null;
  lastActiveAt?: DateValue | null;
  _count?: {
    activityEntries?: number;
  };
}
export interface Activity {
  id: string;
  title: string;
  emoji: string;
  measure: string;
  colorHex?: string | null;
  userId?: string;
  deletedAt?: DateValue | null;
}
export interface Comment {
  id: string;
  text: string;
  userId?: string;
  user: Partial<Person>;
  createdAt?: DateValue;
}
export interface Reaction {
  id?: string;
  emoji: string;
  user?: Person;
  userId?: string;
}
export interface ActivityEntry {
  timezone?: string | null;
  _count?: { comments?: number };
  id: string;
  activityId: string | null;
  userId: string;
  datetime: DateValue;
  quantity: number;
  source?: string;
  startedAt?: DateValue | null;
  endedAt?: DateValue | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  healthWorkout?: {
    id: string;
    displayName: string;
    startAt: DateValue;
    endAt: DateValue;
    durationSeconds: number;
    distanceMeters: number | null;
    activeEnergyKcal: number | null;
    averageHeartRateBpm: number | null;
    maximumHeartRateBpm: number | null;
    healthDataIsPublic: boolean;
  } | null;
  createdAt: DateValue;
  description?: string | null;
  privateNotes?: string | null;
  difficulty?: string | null;
  imageUrl?: string | null;
  imageS3Path?: string | null;
  imageUrls?: string[];
  imageExpiresAt?: DateValue | null;
  deletedAt?: DateValue | null;
  activity?: Activity;
  reactions?: Reaction[];
  comments?: Comment[];
  latitude?: number | null;
  longitude?: number | null;
  sharedActivityEntry?: {
    sharedActivity: {
      entries: {
        user: Person;
        activityEntryId?: string;
        activityEntry?: Partial<ActivityEntry> & { id: string };
      }[];
    };
  } | null;
}
export interface PausePeriod {
  pausedAt: string;
  resumedAt?: string;
  reason?: string;
}
export interface PlanSession {
  id: string;
  date: DateValue;
  activityId: string;
  quantity?: number;
  descriptiveGuide?: string | null;
  imageUrls?: string[];
}
export interface Milestone {
  id: string;
  description: string;
  date: DateValue;
  progress?: number;
  criteria?: unknown;
}
export interface ProgressWeek {
  startDate: DateValue;
  endDate?: DateValue;
  isCompleted: boolean;
  completedActivities?: ActivityEntry[];
  target?: number;
  plannedActivities?: number | PlanSession[];
}
export interface Plan {
  id: string;
  userId?: string;
  goal: string;
  emoji: string;
  goalReason?: string | null;
  notes?: string | null;
  outlineType: "TIMES_PER_WEEK" | "SPECIFIC";
  timesPerWeek: number;
  durationType?: string;
  activities: Activity[];
  sessions: PlanSession[];
  milestones?: Milestone[];
  createdAt: DateValue;
  finishingDate?: DateValue | null;
  archivedAt?: DateValue | null;
  deletedAt?: DateValue | null;
  visibility?: "PUBLIC" | "PRIVATE" | "FRIENDS";
  backgroundImageUrl?: string | null;
  isPaused?: boolean;
  pauseReason?: string | null;
  pauseHistory?: PausePeriod[] | null;
  currentWeekState?: string | null;
  sortOrder?: number;
  coachId?: string | null;
  progress?: {
    weeks?: ProgressWeek[];
    habitAchievement?: {
      isAchieved: boolean;
      progressValue?: number;
      maxValue?: number;
    };
    lifestyleAchievement?: {
      isAchieved: boolean;
      progressValue?: number;
      maxValue?: number;
    };
    achievement?: {
      streak: number;
      completedWeeks?: number;
      totalWeeks?: number;
    };
    currentStreak?: number;
  };
  planGroup?: {
    members: {
      user: Person;
      plan?: { id: string; goal: string };
      leftAt?: DateValue | null;
    }[];
  } | null;
}
export interface Metric {
  id: string;
  title: string;
  emoji: string;
}
export interface MetricEntry {
  id: string;
  metricId: string;
  rating: number;
  date?: DateValue;
  createdAt: DateValue;
  description?: string | null;
  skipped?: boolean;
  descriptionSkipped?: boolean;
}
export interface Achievement {
  id: string;
  userId?: string;
  user: Person;
  achievementType?: "STREAK" | "HABIT" | "LIFESTYLE" | "LEVEL_UP";
  streakNumber?: number | null;
  levelName?: string | null;
  message?: string | null;
  title?: string;
  description?: string;
  createdAt: DateValue;
  plan?: Plan;
  images?: { id: string; url: string }[];
  reactions?: Reaction[];
  comments?: Comment[];
}
export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  from: Person;
  to: Person;
}
export interface AccountStats {
  bestStreak?: number;
  totalActivitiesLogged?: number;
  habitCount?: number;
  lifestyleCount?: number;
  habitBonus?: number;
  lifestyleBonus?: number;
  bonusPoints?: number;
  totalPoints?: number;
}
export interface User extends Person {
  age?: number | null;
  lookingForAp?: boolean;
  profile?: string | null;
  lastSeenTimelineAt?: DateValue | null;
  proactiveCoachingEnabled?: boolean;
  preferredCoachingHour?: number;
  coachPersonality?: "CHAMPION" | "STRATEGIST";
  accountStats?: AccountStats;
  connectionsFrom?: Connection[];
  connectionsTo?: Connection[];
  email?: string;
  isIosNotificationsEnabled?: boolean;
  iosDeviceToken?: string | null;
  iosDeviceTokenUpdatedAt?: DateValue | null;
  planType?: string;
  onboardingCompletedAt?: DateValue | null;
  theme?: string;
  themeMode?: string;
  themeBaseColor?: string;
  reactionEmojis?: string[];
  plans?: Plan[];
  activities?: Activity[];
  activityEntries?: ActivityEntry[];
  achievementPosts?: Achievement[];
  connections?: Person[];
}
export interface TimelinePage {
  recommendedActivityEntries: ActivityEntry[];
  recommendedActivities: Activity[];
  recommendedUsers: User[];
  achievementPosts: Achievement[];
  nextCursor?: string | null;
}
export interface Photo {
  uri: string;
  name: string;
  type: string;
  file?: File;
}
export interface LogActivityInput {
  onUploadProgress?: (percent: number) => void;
  activityId: string;
  datetime: Date;
  quantity: number;
  description?: string;
  privateNotes?: string;
  photos?: Photo[];
  withUserId?: string;
  latitude?: number;
  longitude?: number;
}
export interface SharedCandidate {
  activityEntryId: string;
  user: Person;
  activity: Activity;
  quantity: number;
  datetime: string;
}
export interface LogActivityResult {
  entry: ActivityEntry;
  sharedActivityCandidates: SharedCandidate[];
}
export interface ChildrenProps {
  children: React.ReactNode;
}
