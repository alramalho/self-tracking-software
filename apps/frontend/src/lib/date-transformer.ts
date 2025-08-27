/**
 * Utility to transform date string fields back to Date objects
 * This is needed because Prisma @db.Date fields are serialized as strings
 * when passed through Next.js server actions
 */

type DateFields = 'date' | 'createdAt' | 'updatedAt' | 'finishingDate' | 'imageExpiresAt' | 'imageCreatedAt' | 'deletedAt' | 'sentAt' | 'processedAt' | 'openedAt' | 'concludedAt' | 'lastActiveAt' | 'unactivatedEmailSentAt' | 'suggestedByCoachAt' | 'currentWeekStateCalculatedAt' | 'recommendationsLastCalculatedAt';

/**
 * Transform date string fields to Date objects recursively
 */
export function transformDates<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformDates(item)) as T;
  }

  const result = { ...obj } as any;

  // Transform known date fields
  const dateFields: DateFields[] = [
    'date', 
    'createdAt', 
    'updatedAt', 
    'finishingDate', 
    'imageExpiresAt', 
    'imageCreatedAt',
    'deletedAt',
    'sentAt',
    'processedAt', 
    'openedAt',
    'concludedAt',
    'lastActiveAt',
    'unactivatedEmailSentAt',
    'suggestedByCoachAt',
    'currentWeekStateCalculatedAt',
    'recommendationsLastCalculatedAt'
  ];

  dateFields.forEach(field => {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = new Date(result[field]);
    }
  });

  // Recursively transform nested objects
  Object.keys(result).forEach(key => {
    if (result[key] && typeof result[key] === 'object') {
      result[key] = transformDates(result[key]);
    }
  });

  return result;
}

/**
 * Transform specific data types returned by actions
 */
export function transformUserData<T>(userData: T): T {
  return transformDates(userData);
}

export function transformTimelineData<T>(timelineData: T): T {
  return transformDates(timelineData);
}

export function transformActivityEntries<T>(entries: T): T {
  return transformDates(entries);
}