// Stub implementation - replace with actual implementation when needed
export const useLogError = () => {
  return {
    handleQueryError: (error: any, message: string) => {
      console.error(message, error);
    },
  };
};