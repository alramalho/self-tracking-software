// Simple date validation without zod dependency
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

function isIsoDateString(value: string): boolean {
  return ISO_DATE_REGEX.test(value) && !isNaN(Date.parse(value));
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return current;
    return current[key];
  }, obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (current === null || current === undefined) return current;
    return current[key];
  }, obj);
  
  if (target && typeof target === 'object') {
    target[lastKey] = value;
  }
}

function processNestedArrayField(obj: any, path: string): void {
  const parts = path.split('.');
  
  if (parts.length === 2) {
    // Simple array field like "sessions.date" or "weeks.startDate"
    const [arrayPath, fieldName] = parts;
    const arrayValue = getNestedValue(obj, arrayPath);
    if (Array.isArray(arrayValue)) {
      arrayValue.forEach(item => {
        if (item && typeof item === 'object') {
          const value = item[fieldName];
          if (value && typeof value === 'string' && isIsoDateString(value)) {
            item[fieldName] = new Date(value);
          }
        }
      });
    }
  } else if (parts.length === 3) {
    // Nested array field like "activityEntries.comments.createdAt" or "weeks.completedActivities.date"
    const [rootArray, nestedArray, fieldName] = parts;
    const rootArrayValue = getNestedValue(obj, rootArray);
    if (Array.isArray(rootArrayValue)) {
      rootArrayValue.forEach(rootItem => {
        if (rootItem && typeof rootItem === 'object') {
          const nestedValue = rootItem[nestedArray];
          if (Array.isArray(nestedValue)) {
            // Handle array within array
            nestedValue.forEach(nestedItem => {
              if (nestedItem && typeof nestedItem === 'object') {
                const value = nestedItem[fieldName];
                if (value && typeof value === 'string' && isIsoDateString(value)) {
                  nestedItem[fieldName] = new Date(value);
                }
              }
            });
          } else if (nestedValue && typeof nestedValue === 'object') {
            // Handle single object within array
            const value = nestedValue[fieldName];
            if (value && typeof value === 'string' && isIsoDateString(value)) {
              nestedValue[fieldName] = new Date(value);
            }
          }
        }
      });
    }
  }
}

export function normalizeApiResponse<T>(
  obj: any,
  dateFields: string[]
): T {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = JSON.parse(JSON.stringify(obj)); // Deep clone
  
  dateFields.forEach(fieldPath => {
    if (fieldPath.includes('.')) {
      // Handle nested paths (including arrays)
      processNestedArrayField(result, fieldPath);
    } else {
      // Handle simple field paths
      const value = getNestedValue(result, fieldPath);
      if (value && typeof value === 'string' && isIsoDateString(value)) {
        setNestedValue(result, fieldPath, new Date(value));
      }
    }
  });
  
  return result;
}

// Helper for array fields - applies normalization to each item in an array
export function normalizeApiResponseArray<T>(
  arr: any[],
  dateFields: string[]
): T[] {
  return arr.map(item => normalizeApiResponse<T>(item, dateFields));
}