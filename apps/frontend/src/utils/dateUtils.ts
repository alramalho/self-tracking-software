const isIsoDateString = (value: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
};

const processNestedField = (obj: any, path: string[]): void => {
  if (path.length === 1) {
    // Base case: we're at the final field name
    const fieldName = path[0];
    if (
      obj[fieldName] &&
      typeof obj[fieldName] === "string" &&
      isIsoDateString(obj[fieldName])
    ) {
      obj[fieldName] = new Date(obj[fieldName]);
    }
    return;
  }

  // Recursive case: navigate deeper
  const [currentKey, ...remainingPath] = path;
  const currentValue = obj[currentKey];

  if (!currentValue) return;

  if (Array.isArray(currentValue)) {
    // If it's an array, process each item recursively
    currentValue.forEach((item) => {
      if (item && typeof item === "object") {
        processNestedField(item, remainingPath);
      }
    });
  } else if (typeof currentValue === "object") {
    // If it's an object, continue down the path
    processNestedField(currentValue, remainingPath);
  }
};

export const normalizeApiResponse = <T>(data: any, dateFields: string[]): T => {
  const result = { ...data };

  dateFields.forEach((field) => {
    const path = field.split(".");
    processNestedField(result, path);
  });

  return result as T;
};

export const normalizeApiResponseArray = <T>(
  data: any[],
  dateFields: string[]
): T[] => {
  return data.map((item) => normalizeApiResponse<T>(item, dateFields));
};
