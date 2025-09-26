// Stub implementation - replace with actual implementation when needed
export const normalizeApiResponse = <T>(data: any, dateFields: string[]): T => {
  const result = { ...data };

  // Convert string dates to Date objects for the specified fields
  dateFields.forEach(field => {
    if (field.includes('.')) {
      // Handle nested fields like 'sessions.date'
      const [parent, child] = field.split('.');
      if (result[parent] && Array.isArray(result[parent])) {
        result[parent] = result[parent].map((item: any) => ({
          ...item,
          [child]: item[child] ? new Date(item[child]) : null
        }));
      }
    } else {
      // Handle direct fields
      if (result[field]) {
        result[field] = new Date(result[field]);
      }
    }
  });

  return result as T;
};

export const normalizeApiResponseArray = <T>(data: any[], dateFields: string[]): T[] => {
  return data.map(item => normalizeApiResponse<T>(item, dateFields));
};